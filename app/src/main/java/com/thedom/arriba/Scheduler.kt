package com.thedom.arriba

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import org.json.JSONObject
import java.util.Calendar

/** Programa las alarmas en el sistema con AlarmManager.setAlarmClock (la forma más confiable de despertar). */
object Scheduler {
    const val EXTRA_ID = "alarmId"
    const val EXTRA_KIND = "kind" // "alarm" | "snooze" | "resume"

    private fun pending(ctx: Context, code: Int, id: Int, kind: String): PendingIntent {
        val i = Intent(ctx, AlarmReceiver::class.java)
            .putExtra(EXTRA_ID, id)
            .putExtra(EXTRA_KIND, kind)
        return PendingIntent.getBroadcast(
            ctx, code, i,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun showIntent(ctx: Context): PendingIntent {
        val i = Intent(ctx, MainActivity::class.java)
        return PendingIntent.getActivity(ctx, 9, i, PendingIntent.FLAG_IMMUTABLE)
    }

    /** Próximo momento en que debe sonar la alarma, o null si está apagada. */
    fun nextTrigger(a: JSONObject, from: Long = System.currentTimeMillis()): Long? {
        if (!a.optBoolean("enabled", true)) return null
        val h = a.optInt("hour", 7)
        val m = a.optInt("minute", 0)
        val daysArr = a.optJSONArray("days")
        val days = mutableSetOf<Int>()
        if (daysArr != null) for (i in 0 until daysArr.length()) days.add(daysArr.optInt(i))

        val c = Calendar.getInstance().apply {
            timeInMillis = from
            set(Calendar.HOUR_OF_DAY, h)
            set(Calendar.MINUTE, m)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        if (c.timeInMillis <= from) c.add(Calendar.DAY_OF_YEAR, 1)
        if (days.isEmpty()) return c.timeInMillis
        repeat(8) {
            // Calendar: domingo=1 ... sábado=7  → nuestro formato: lunes=1 ... domingo=7
            val dow = c.get(Calendar.DAY_OF_WEEK)
            val ours = if (dow == Calendar.SUNDAY) 7 else dow - 1
            if (ours in days) return c.timeInMillis
            c.add(Calendar.DAY_OF_YEAR, 1)
        }
        return null
    }

    fun rescheduleAll(ctx: Context) {
        val am = ctx.getSystemService(AlarmManager::class.java)
        for (a in Store.alarms(ctx)) {
            val id = a.optInt("id")
            val pi = pending(ctx, id, id, "alarm")
            am.cancel(pi)
            val t = nextTrigger(a) ?: continue
            try {
                am.setAlarmClock(AlarmManager.AlarmClockInfo(t, showIntent(ctx)), pi)
            } catch (e: SecurityException) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi)
            }
        }
    }

    fun cancel(ctx: Context, id: Int) {
        val am = ctx.getSystemService(AlarmManager::class.java)
        am.cancel(pending(ctx, id, id, "alarm"))
    }

    /** Posponer: vuelve a sonar en X minutos (la misión sigue pendiente). */
    fun scheduleSnooze(ctx: Context, id: Int, minutes: Int) {
        scheduleAt(ctx, 100000 + (id % 100000), id, "snooze", System.currentTimeMillis() + minutes * 60_000L)
    }

    /** Reanudar una alarma que quedó sin resolver (por ejemplo, después de reiniciar el teléfono). */
    fun scheduleResume(ctx: Context, id: Int, delayMs: Long) {
        scheduleAt(ctx, 200000 + (id % 100000), id, "resume", System.currentTimeMillis() + delayMs)
    }

    /** Alarma de prueba */
    fun scheduleTest(ctx: Context, id: Int, delayMs: Long) {
        scheduleAt(ctx, 300000, id, "test", System.currentTimeMillis() + delayMs)
    }

    private fun scheduleAt(ctx: Context, code: Int, id: Int, kind: String, t: Long) {
        val am = ctx.getSystemService(AlarmManager::class.java)
        val pi = pending(ctx, code, id, kind)
        try {
            am.setAlarmClock(AlarmManager.AlarmClockInfo(t, showIntent(ctx)), pi)
        } catch (e: SecurityException) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, pi)
        }
    }

    fun nextAlarmInfo(ctx: Context): JSONObject {
        var best: Long? = null
        var bestId = -1
        for (a in Store.alarms(ctx)) {
            val t = nextTrigger(a) ?: continue
            if (best == null || t < best) { best = t; bestId = a.optInt("id") }
        }
        return JSONObject().put("time", best ?: 0L).put("id", bestId)
    }
}
