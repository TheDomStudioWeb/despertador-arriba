package com.thedom.arriba

import android.Manifest
import android.app.Activity
import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.label.ImageLabeling
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions
import org.json.JSONArray
import org.json.JSONObject

/** Puente entre la interfaz (HTML/JS) y el teléfono. En JS se usa como window.Android */
class Bridge(private val act: Activity, private val web: WebView) : SensorEventListener {

    private val ctx: Context = act.applicationContext
    private val main = Handler(Looper.getMainLooper())
    private val sm = ctx.getSystemService(SensorManager::class.java)
    private val accelBuf = StringBuilder()
    private var accelCount = 0
    private var preview: MediaPlayer? = null

    private fun js(code: String) { main.post { try { web.evaluateJavascript(code, null) } catch (_: Exception) { } } }
    private fun callback(cb: String, json: String) {
        js("window.__cb && window.__cb(${JSONObject.quote(cb)}, $json)")
    }

    // ---------- Alarmas ----------
    @JavascriptInterface fun getAlarms(): String = Store.alarmsJson(ctx)
    @JavascriptInterface fun saveAlarms(json: String): String {
        Store.saveAlarmsJson(ctx, json)
        Scheduler.rescheduleAll(ctx)
        return Scheduler.nextAlarmInfo(ctx).toString()
    }
    @JavascriptInterface fun nextAlarm(): String = Scheduler.nextAlarmInfo(ctx).toString()
    @JavascriptInterface fun testAlarm(id: Int, seconds: Int) { Scheduler.scheduleTest(ctx, id, seconds * 1000L) }

    @JavascriptInterface fun getRefs(): String = Store.refsJson(ctx)
    @JavascriptInterface fun saveRefs(json: String) { Store.saveRefsJson(ctx, json) }
    @JavascriptInterface fun getSettings(): String = Store.settingsJson(ctx)
    @JavascriptInterface fun saveSettings(json: String) { Store.saveSettingsJson(ctx, json) }
    @JavascriptInterface fun history(): String = Store.historyJson(ctx)

    // ---------- Alarma sonando ----------
    @JavascriptInterface fun ringInfo(): String {
        val id = Store.ringingId(ctx)
        return JSONObject()
            .put("id", id)
            .put("alarm", Store.alarm(ctx, id) ?: JSONObject())
            .put("snoozes", Store.snoozesUsed(ctx))
            .put("lastMission", Store.lastMission(ctx))
            .toString()
    }
    @JavascriptInterface fun setLastMission(m: String) { Store.setLastMission(ctx, m) }
    @JavascriptInterface fun ping() { AlarmService.ping() }
    @JavascriptInterface fun missionDone() {
        stopSensors()
        AlarmService.finish(ctx, true)
        main.post { act.finish() }
    }
    @JavascriptInterface fun snooze(): Boolean {
        val id = Store.ringingId(ctx)
        val a = Store.alarm(ctx, id) ?: return false
        val max = a.optInt("snoozeMax", 0)
        if (Store.snoozesUsed(ctx) >= max) return false
        stopSensors()
        AlarmService.snooze(ctx, a.optInt("snoozeMin", 5).coerceIn(1, 30))
        main.post { act.finish() }
        return true
    }

    // ---------- Visión (ML Kit, funciona sin internet) ----------
    private fun decode(dataUrl: String): InputImage? = try {
        val b64 = dataUrl.substringAfter(",")
        val bytes = Base64.decode(b64, Base64.DEFAULT)
        val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        InputImage.fromBitmap(bmp, 0)
    } catch (e: Exception) { null }

    @JavascriptInterface fun labelImage(dataUrl: String, cb: String) {
        val img = decode(dataUrl) ?: return callback(cb, "[]")
        val labeler = ImageLabeling.getClient(
            ImageLabelerOptions.Builder().setConfidenceThreshold(0.35f).build()
        )
        labeler.process(img)
            .addOnSuccessListener { labels ->
                val arr = JSONArray()
                for (l in labels) arr.put(JSONObject().put("t", l.text).put("c", l.confidence.toDouble()))
                callback(cb, arr.toString())
                labeler.close()
            }
            .addOnFailureListener { callback(cb, "[]"); labeler.close() }
    }

    @JavascriptInterface fun scanBarcode(dataUrl: String, cb: String) {
        val img = decode(dataUrl) ?: return callback(cb, "[]")
        val scanner = BarcodeScanning.getClient()
        scanner.process(img)
            .addOnSuccessListener { codes ->
                val arr = JSONArray()
                for (c in codes) c.rawValue?.let { arr.put(it) }
                callback(cb, arr.toString())
                scanner.close()
            }
            .addOnFailureListener { callback(cb, "[]"); scanner.close() }
    }

    // ---------- Sensores ----------
    @JavascriptInterface fun hasStepSensor(): Boolean =
        sm.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR) != null &&
            (Build.VERSION.SDK_INT < 29 || granted(Manifest.permission.ACTIVITY_RECOGNITION))

    @JavascriptInterface fun hasLightSensor(): Boolean = sm.getDefaultSensor(Sensor.TYPE_LIGHT) != null

    @JavascriptInterface fun startSensor(kind: String): Boolean {
        val type = when (kind) {
            "accel" -> Sensor.TYPE_ACCELEROMETER
            "steps" -> Sensor.TYPE_STEP_DETECTOR
            "light" -> Sensor.TYPE_LIGHT
            else -> return false
        }
        val s = sm.getDefaultSensor(type) ?: return false
        return sm.registerListener(this, s, SensorManager.SENSOR_DELAY_GAME)
    }

    @JavascriptInterface fun stopSensors() {
        try { sm.unregisterListener(this) } catch (_: Exception) { }
    }

    override fun onSensorChanged(e: SensorEvent) {
        when (e.sensor.type) {
            Sensor.TYPE_ACCELEROMETER -> {
                // Se juntan muestras y se mandan a la interfaz de a tandas
                accelBuf.append('[').append(e.values[0]).append(',').append(e.values[1]).append(',')
                    .append(e.values[2]).append(',').append(e.timestamp / 1_000_000).append("],")
                accelCount++
                if (accelCount >= 5) {
                    val data = "[" + accelBuf.toString().trimEnd(',') + "]"
                    accelBuf.setLength(0); accelCount = 0
                    js("window.__sensor && window.__sensor('accel', $data)")
                }
            }
            Sensor.TYPE_STEP_DETECTOR -> js("window.__sensor && window.__sensor('step', 1)")
            Sensor.TYPE_LIGHT -> js("window.__sensor && window.__sensor('light', ${e.values[0]})")
        }
    }
    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    // ---------- Sonidos ----------
    @JavascriptInterface fun previewSound(name: String) {
        stopPreview()
        val uri: Uri = when (name) {
            "sistema" -> RingtoneManager.getActualDefaultRingtoneUri(ctx, RingtoneManager.TYPE_ALARM)
                ?: Uri.parse("android.resource://${ctx.packageName}/${R.raw.tono_clasico}")
            "digital" -> Uri.parse("android.resource://${ctx.packageName}/${R.raw.tono_digital}")
            "sirena" -> Uri.parse("android.resource://${ctx.packageName}/${R.raw.tono_sirena}")
            "campanas" -> Uri.parse("android.resource://${ctx.packageName}/${R.raw.tono_campanas}")
            else -> Uri.parse("android.resource://${ctx.packageName}/${R.raw.tono_clasico}")
        }
        preview = try {
            MediaPlayer().apply {
                setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build())
                setDataSource(ctx, uri)
                prepare()
                start()
            }
        } catch (e: Exception) { null }
        main.postDelayed({ stopPreview() }, 4000)
    }
    @JavascriptInterface fun stopPreview() {
        try { preview?.stop(); preview?.release() } catch (_: Exception) { }
        preview = null
    }

    @JavascriptInterface fun vibrate(ms: Int) {
        try {
            @Suppress("DEPRECATION")
            val v = ctx.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            v.vibrate(VibrationEffect.createOneShot(ms.toLong(), VibrationEffect.DEFAULT_AMPLITUDE))
        } catch (_: Exception) { }
    }

    @JavascriptInterface fun openUrl(url: String) {
        try { act.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (_: Exception) { }
    }

    // ---------- Permisos ----------
    private fun granted(p: String) = ContextCompat.checkSelfPermission(ctx, p) == PackageManager.PERMISSION_GRANTED

    @JavascriptInterface fun permissions(): String {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        val am = ctx.getSystemService(AlarmManager::class.java)
        val pm = ctx.getSystemService(PowerManager::class.java)
        return JSONObject()
            .put("notifications", if (Build.VERSION.SDK_INT >= 33) granted(Manifest.permission.POST_NOTIFICATIONS) else nm.areNotificationsEnabled())
            .put("fullscreen", if (Build.VERSION.SDK_INT >= 34) nm.canUseFullScreenIntent() else true)
            .put("overlay", Settings.canDrawOverlays(ctx))
            .put("exact", if (Build.VERSION.SDK_INT >= 31) am.canScheduleExactAlarms() else true)
            .put("battery", pm.isIgnoringBatteryOptimizations(ctx.packageName))
            .put("camera", granted(Manifest.permission.CAMERA))
            .put("activity", if (Build.VERSION.SDK_INT >= 29) granted(Manifest.permission.ACTIVITY_RECOGNITION) else true)
            .toString()
    }

    @JavascriptInterface fun requestPermission(name: String) {
        main.post {
            try {
                val pkg = Uri.parse("package:${ctx.packageName}")
                when (name) {
                    "notifications" -> if (Build.VERSION.SDK_INT >= 33)
                        act.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 11)
                    else act.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName))
                    "camera" -> act.requestPermissions(arrayOf(Manifest.permission.CAMERA), 12)
                    "activity" -> if (Build.VERSION.SDK_INT >= 29)
                        act.requestPermissions(arrayOf(Manifest.permission.ACTIVITY_RECOGNITION), 13)
                    "overlay" -> act.startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, pkg))
                    "fullscreen" -> if (Build.VERSION.SDK_INT >= 34)
                        act.startActivity(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkg))
                    "exact" -> if (Build.VERSION.SDK_INT >= 31)
                        act.startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, pkg))
                    "battery" -> act.startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, pkg))
                }
            } catch (e: Exception) {
                try { act.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${ctx.packageName}"))) } catch (_: Exception) { }
            }
        }
    }

    fun release() {
        stopSensors()
        stopPreview()
    }
}
