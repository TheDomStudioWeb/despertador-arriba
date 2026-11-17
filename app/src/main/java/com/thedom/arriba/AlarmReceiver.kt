package com.thedom.arriba

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/** Llega cuando el sistema dispara la alarma: arranca el servicio que suena. */
class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val id = intent.getIntExtra(Scheduler.EXTRA_ID, -1)
        val kind = intent.getStringExtra(Scheduler.EXTRA_KIND) ?: "alarm"
        if (id == -1) return

        if (kind == "alarm") {
            // Si ya hay otra sonando, esta se suma a la misma pantalla (no se pisa)
            if (Store.ringingId(ctx) == -1) Store.setRinging(ctx, id)
            Store.disableOneShot(ctx, id)
        } else {
            // snooze / resume: sigue la misma alarma pendiente
            if (Store.ringingId(ctx) == -1) Store.setRinging(ctx, id)
            Store.setSnoozed(ctx, false)
        }
        // Programar la próxima repetición de esta alarma
        Scheduler.rescheduleAll(ctx)

        val svc = Intent(ctx, AlarmService::class.java).putExtra(Scheduler.EXTRA_ID, Store.ringingId(ctx))
        ContextCompat.startForegroundService(ctx, svc)
    }
}

/** Al reiniciar el teléfono (o actualizar la app) vuelve a programar todo.
 *  Si una alarma quedó sonando sin cumplir la misión, la vuelve a hacer sonar. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        Scheduler.rescheduleAll(ctx)
        val pending = Store.ringingId(ctx)
        // (si estaba pospuesta, reiniciar el teléfono no sirve de truco: vuelve a sonar enseguida)
        if (pending != -1) {
            Scheduler.scheduleResume(ctx, pending, 8_000L)
        }
    }
}
