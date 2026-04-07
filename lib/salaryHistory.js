function toDateOnly(value) {
  if (!value) return null
  const iso = String(value).split("T")[0]
  return iso
}

export function resolveEffectiveSalaryFromHistory(historyRows, dateValue) {
  if (!Array.isArray(historyRows) || historyRows.length === 0) return null

  const target = toDateOnly(dateValue)
  if (!target) return null

  for (const row of historyRows) {
    const effective = toDateOnly(row.fecha_vigencia)
    if (!effective) continue

    if (effective <= target) {
      return {
        salary: row.salario_base !== null && row.salario_base !== undefined ? Number(row.salario_base) : null,
        hourlyRate: row.valor_hora !== null && row.valor_hora !== undefined ? Number(row.valor_hora) : null,
        weeklyHours: row.horas_semanales !== null && row.horas_semanales !== undefined ? Number(row.horas_semanales) : null,
        monthlyHours: row.horas_mensuales !== null && row.horas_mensuales !== undefined ? Number(row.horas_mensuales) : null,
        effectiveDate: effective,
      }
    }
  }

  return null
}

export async function getSalaryHistoryForUser(prismaClient, usuarioId, upToDate) {
  if (!usuarioId) return []

  const where = {
    usuario_id: usuarioId,
    ...(upToDate
      ? {
          fecha_vigencia: {
            lte: new Date(`${toDateOnly(upToDate)}T00:00:00.000Z`),
          },
        }
      : {}),
  }

  return prismaClient.historial_salarios.findMany({
    where,
    orderBy: [{ fecha_vigencia: "desc" }, { created_at: "desc" }],
  })
}

export async function appendSalaryHistoryEntry(prismaClient, {
  usuarioId,
  effectiveDate,
  salarioBase,
  valorHora,
  horasSemanales,
  horasMensuales,
  motivo,
  origen = "MANUAL",
  createdBy,
}) {
  if (!usuarioId || !effectiveDate) {
    return null
  }

  const dateOnly = toDateOnly(effectiveDate)

  return prismaClient.historial_salarios.create({
    data: {
      usuario_id: usuarioId,
      fecha_vigencia: new Date(`${dateOnly}T00:00:00.000Z`),
      salario_base: salarioBase,
      valor_hora: valorHora,
      horas_semanales: horasSemanales,
      horas_mensuales: horasMensuales,
      motivo: motivo || null,
      origen,
      created_by: createdBy || null,
    },
  })
}

