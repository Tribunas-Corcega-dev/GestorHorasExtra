import { supabaseAdmin } from "@/lib/supabaseAdmin"

/**
 * Logs an action to the audit_logs table.
 * 
 * @param {Object} params
 * @param {string} params.action - The action performed (e.g., 'CREATE', 'UPDATE', 'DELETE')
 * @param {string} params.entity - The entity affected (e.g., 'EMPLEADO', 'CONFIGURACION')
 * @param {string} params.entityId - The ID of the affected entity
 * @param {Object} [params.details] - Detailed changes or metadata
 * @param {Object} [params.user] - The user performing the action (must include .nombre)
 */
export async function logAudit({ action, entity, entityId, details, user }) {
  try {
    const logEntry = {
      action,
      entity,
      entity_id: entityId ? String(entityId) : null,
      details: details || {},
      created_at: new Date().toISOString()
    }

    if (user) {
      logEntry.user_id = user.id
      logEntry.user_name = user.nombre || user.username || 'Desconocido'
    } else {
      logEntry.user_name = 'SYSTEM'
    }

    const { error } = await supabaseAdmin
      .from("audit_logs")
      .insert(logEntry)

    if (error) {
      console.error("[AUDIT] Failed to write log:", error)
    } else {
      console.log(`[AUDIT] Logged ${action} on ${entity} ${entityId} by ${logEntry.user_name}`)
    }
  } catch (err) {
    console.error("[AUDIT] Exception:", err)
  }
}
