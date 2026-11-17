package com.thedom.arriba

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

/**
 * Guardado simple en el teléfono (SharedPreferences).
 * - alarms: lista de alarmas en JSON (la arma la interfaz web)
 * - refs: objetos y códigos registrados para las misiones
 * - ring: estado de la alarma que está sonando (sobrevive a reinicios)
 */
object Store {
    private const val PREFS = "arriba"

    private fun p(ctx: Context): SharedPreferences =
        ctx.applicationContext.createDeviceProtectedStorageContext()
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun alarmsJson(ctx: Context): String = p(ctx).getString("alarms", "[]") ?: "[]"
    fun saveAlarmsJson(ctx: Context, json: String) { p(ctx).edit().putString("alarms", json).apply() }

    fun alarms(ctx: Context): List<JSONObject> {
        val arr = try { JSONArray(alarmsJson(ctx)) } catch (e: Exception) { JSONArray() }
        return (0 until arr.length()).map { arr.getJSONObject(it) }
    }

    fun alarm(ctx: Context, id: Int): JSONObject? = alarms(ctx).firstOrNull { it.optInt("id") == id }

    /** Una alarma de una sola vez se apaga después de sonar */
    fun disableOneShot(ctx: Context, id: Int) {
        val arr = try { JSONArray(alarmsJson(ctx)) } catch (e: Exception) { return }
        for (i in 0 until arr.length()) {
            val a = arr.getJSONObject(i)
            if (a.optInt("id") == id) {
                val days = a.optJSONArray("days")
                if (days == null || days.length() == 0) a.put("enabled", false)
            }
        }
        saveAlarmsJson(ctx, arr.toString())
    }

    fun refsJson(ctx: Context): String = p(ctx).getString("refs", "[]") ?: "[]"
    fun saveRefsJson(ctx: Context, json: String) { p(ctx).edit().putString("refs", json).apply() }

    fun settingsJson(ctx: Context): String = p(ctx).getString("settings", "{}") ?: "{}"
    fun saveSettingsJson(ctx: Context, json: String) { p(ctx).edit().putString("settings", json).apply() }

    // ---- Estado de la alarma sonando ----
    fun ringingId(ctx: Context): Int = p(ctx).getInt("ringId", -1)
    fun setRinging(ctx: Context, id: Int) {
        val prev = ringingId(ctx)
        val e = p(ctx).edit().putInt("ringId", id).putLong("ringSince", System.currentTimeMillis())
        if (prev != id) e.putInt("snoozes", 0)
        e.commit()
    }
    fun clearRinging(ctx: Context) {
        p(ctx).edit().putInt("ringId", -1).putInt("snoozes", 0).putBoolean("snoozed", false).commit()
    }
    fun snoozesUsed(ctx: Context): Int = p(ctx).getInt("snoozes", 0)
    fun addSnooze(ctx: Context) {
        p(ctx).edit().putInt("snoozes", snoozesUsed(ctx) + 1).putBoolean("snoozed", true).commit()
    }
    fun isSnoozed(ctx: Context): Boolean = p(ctx).getBoolean("snoozed", false)
    fun setSnoozed(ctx: Context, v: Boolean) { p(ctx).edit().putBoolean("snoozed", v).commit() }

    // Volumen original de alarmas, para devolverlo al terminar
    fun savedVolume(ctx: Context): Int = p(ctx).getInt("vol", -1)
    fun saveVolume(ctx: Context, v: Int) { p(ctx).edit().putInt("vol", v).commit() }

    // Última misión usada (para no repetir dos días seguidos)
    fun lastMission(ctx: Context): String = p(ctx).getString("lastMission", "") ?: ""
    fun setLastMission(ctx: Context, m: String) { p(ctx).edit().putString("lastMission", m).apply() }

    fun historyJson(ctx: Context): String = p(ctx).getString("history", "[]") ?: "[]"
    fun addHistory(ctx: Context, entry: JSONObject) {
        val arr = try { JSONArray(historyJson(ctx)) } catch (e: Exception) { JSONArray() }
        arr.put(entry)
        val out = JSONArray()
        val start = maxOf(0, arr.length() - 60)
        for (i in start until arr.length()) out.put(arr.get(i))
        p(ctx).edit().putString("history", out.toString()).apply()
    }
}
