export function canManageEmployees(rol) {
  return ["TALENTO_HUMANO", "ASISTENTE_GERENCIA", "JEFE", "COORDINADOR"].includes(rol)
}

export function isCoordinator(rol) {
  return rol === "COORDINADOR"
}

export function isWorker(rol) {
  return rol === "OPERARIO"
}

export function canSeeAllEmployees(rol) {
  return ["TALENTO_HUMANO", "ASISTENTE_GERENCIA", "JEFE"].includes(rol)
}

export function canManageOvertime(rol) {
  return ["TALENTO_HUMANO", "ASISTENTE_GERENCIA", "COORDINADOR", "JEFE"].includes(rol)
}
