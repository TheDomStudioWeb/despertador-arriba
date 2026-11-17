package com.thedom.arriba

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import org.json.JSONObject

/**
 * Servicio que hace sonar la alarma. No tiene botón para apagarla:
 * solo se detiene cuando la pantalla de la misión avisa que se cumplió (o se pospone, si está permitido).
 */
class AlarmService : Service() {

    companion object {
        const val CHANNEL = "arriba_alarma"
        @Volatile var instance: AlarmService? = null
        @Volatile var lastActivity: Long = 0L

        /** La misión se está haciendo: baja el volumen un rato (vuelve a full si se deja de hacer). */
        fun ping() { lastActivity = System.currentTimeMillis() }

        fun finish(ctx: Context, completed: Boolean) {
            val id = Store.ringingId(ctx)
            if (id != -1) {
                val e = JSONObject().put("t", System.currentTimeMillis()).put("id", id)
                    .put("ok", completed).put("snoozes", Store.snoozesUsed(ctx))
                Store.addHistory(ctx, e)
            }
            Store.clearRinging(ctx)
            instance?.stopEverything()
            ctx.stopService(Intent(ctx, AlarmService::class.java))
        }

        fun snooze(ctx: Context, minutes: Int) {
            val id = Store.ringingId(ctx)
            if (id == -1) return
            Store.addSnooze(ctx)
            Scheduler.scheduleSnooze(ctx, id, minutes)
            instance?.stopEverything()
            ctx.stopService(Intent(ctx, AlarmService::class.java))
        }
    }

    private var player: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var wake: PowerManager.WakeLock? = null
    private val handler = Handler(Looper.getMainLooper())
    private var startedAt = 0L
    private var stopped = false
    private var hiddenTicks = 0

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val id = Store.ringingId(this)
        createChannel()
        val notif = buildNotification(id)
        val type = if (Build.VERSION.SDK_INT >= 29) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK else 0
        ServiceCompat.startForeground(this, 1, notif, type)

        if (id == -1) { stopSelf(); return START_NOT_STICKY }
        if (player == null) {
            stopped = false
            startedAt = System.currentTimeMillis()
            lastActivity = 0L
            acquireWake()
            startSound(Store.alarm(this, id))
            startVibration(Store.alarm(this, id))
            handler.post(watchdog)
        }
        openRingScreen()
        return START_STICKY
    }

    private fun createChannel() {
        val nm = getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) == null) {
            val ch = NotificationChannel(CHANNEL, "Alarma sonando", NotificationManager.IMPORTANCE_HIGH)
            ch.setSound(null, null)
            ch.enableVibration(false)
            ch.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            ch.setBypassDnd(true)
            nm.createNotificationChannel(ch)
        }
    }

    private fun ringIntent(): PendingIntent {
        val i = Intent(this, RingActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION)
        return PendingIntent.getActivity(this, 1, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun buildNotification(id: Int): Notification {
        val a = if (id != -1) Store.alarm(this, id) else null
        val label = a?.optString("label")?.takeIf { it.isNotBlank() } ?: "¡Arriba!"
        return NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_alarm)
            .setContentTitle(label)
            .setContentText("Cumplí la misión para apagar la alarma")
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(ringIntent())
            .setFullScreenIntent(ringIntent(), true)
            .build()
    }

    private fun acquireWake() {
        val pm = getSystemService(PowerManager::class.java)
        wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "arriba:ring").apply {
            setReferenceCounted(false)
            acquire(60 * 60 * 1000L)
        }
    }

    private fun soundUri(a: JSONObject?): Uri {
        val name = a?.optString("sound", "clasico") ?: "clasico"
        if (name == "sistema") {
            val u = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM)
            if (u != null) return u
        }
        val res = when (name) {
            "digital" -> R.raw.tono_digital
            "sirena" -> R.raw.tono_sirena
            "campanas" -> R.raw.tono_campanas
            else -> R.raw.tono_clasico
        }
        return Uri.parse("android.resource://$packageName/$res")
    }

    private fun startSound(a: JSONObject?) {
        val am = getSystemService(AudioManager::class.java)
        if (Store.savedVolume(this) == -1) Store.saveVolume(this, am.getStreamVolume(AudioManager.STREAM_ALARM))
        forceMaxVolume()
        player = try {
            MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(this@AlarmService, soundUri(a))
                isLooping = true
                prepare()
                setVolume(0.5f, 0.5f)
                start()
            }
        } catch (e: Exception) {
            try {
                MediaPlayer().apply {
                    setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build())
                    setDataSource(this@AlarmService, Uri.parse("android.resource://$packageName/${R.raw.tono_clasico}"))
                    isLooping = true
                    prepare()
                    start()
                }
            } catch (e2: Exception) { null }
        }
    }

    private fun forceMaxVolume() {
        val am = getSystemService(AudioManager::class.java)
        try {
            am.setStreamVolume(AudioManager.STREAM_ALARM, am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0)
        } catch (_: Exception) { }
    }

    private fun startVibration(a: JSONObject?) {
        if (a != null && !a.optBoolean("vibrate", true)) return
        vibrator = if (Build.VERSION.SDK_INT >= 31) {
            getSystemService(VibratorManager::class.java).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
        val pattern = longArrayOf(0, 800, 600)
        val attrs = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build()
        @Suppress("DEPRECATION")
        vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0), attrs)
    }

    /** Cada 2 segundos: controla volumen y que la pantalla de la misión esté adelante. */
    private val watchdog = object : Runnable {
        override fun run() {
            if (stopped) return
            val now = System.currentTimeMillis()
            val quiet = now - lastActivity < 25_000L
            // Sube de a poco los primeros 15 segundos, después a todo volumen
            val ramp = (0.5f + (now - startedAt) / 30_000f).coerceAtMost(1f)
            val v = if (quiet) 0.12f else ramp
            try { player?.setVolume(v, v) } catch (_: Exception) { }
            if (!quiet) forceMaxVolume()
            if (!RingActivity.visible) { hiddenTicks++; if (hiddenTicks >= 2) openRingScreen() } else hiddenTicks = 0
            handler.postDelayed(this, 2000)
        }
    }

    private fun openRingScreen() {
        try {
            startActivity(
                Intent(this, RingActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            )
        } catch (_: Exception) { }
    }

    fun stopEverything() {
        if (stopped) return
        stopped = true
        handler.removeCallbacksAndMessages(null)
        try { player?.stop() } catch (_: Exception) { }
        try { player?.release() } catch (_: Exception) { }
        player = null
        try { vibrator?.cancel() } catch (_: Exception) { }
        val saved = Store.savedVolume(this)
        if (saved >= 0) {
            try { getSystemService(AudioManager::class.java).setStreamVolume(AudioManager.STREAM_ALARM, saved, 0) } catch (_: Exception) { }
            Store.saveVolume(this, -1)
        }
        try { wake?.release() } catch (_: Exception) { }
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    }

    override fun onDestroy() {
        // Si el sistema mata el servicio con la misión sin cumplir, se reprograma enseguida
        val pending = Store.ringingId(this)
        val wasStopped = stopped
        stopEverything()
        instance = null
        if (!wasStopped && pending != -1 && !Store.isSnoozed(this)) {
            Scheduler.scheduleResume(this, pending, 3_000L)
        }
        super.onDestroy()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        // Deslizar la app en "recientes" no la apaga
        val pending = Store.ringingId(this)
        if (pending != -1) Scheduler.scheduleResume(this, pending, 2_000L)
        super.onTaskRemoved(rootIntent)
    }
}
