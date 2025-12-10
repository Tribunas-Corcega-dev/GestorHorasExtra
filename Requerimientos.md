# Requerimientos del Sistema de Gestión de Horarios y Horas Extra

## 1. Requerimientos del Sistema

### 1.1 Gestión de Usuarios y Roles
- **Coordinadores:** (Acueducto, Aseo y Alcantarillado), **Jefe**, **Talento Humano**, **Asistente de Gerencia** y **Trabajadores/Operarios**.
- La creación de usuarios solo puede realizarse desde los perfiles: Talento Humano, Asistente de Gerencia o Jefe.
- Al crear un usuario se deberán ingresar: datos personales, área asignada, tipo de trabajador (Coordinador u Operario), salario base y jornada laboral fija.
- Cada coordinador solo puede gestionar y consultar trabajadores de su área.
- Los operarios solo pueden visualizar su propia información, nunca la de otros trabajadores.

### 1.2 Gestión de Horarios y Jornadas
- Existirá una interfaz donde se mostrará una lista de empleados con: nombre, foto, cargo y área.
- Se podrán aplicar filtros por: orden alfabético (asc/desc), cargo y área.
- Cada empleado tendrá botones de acción: Ver Detalles/Registro de Jornadas, Ingresar Jornada Manualmente, Editar Información (solo para roles autorizados).
- Al ingresar jornada manual se seleccionará la fecha desde un calendario.
- La jornada podrá ingresarse en dos mitades (mañana y tarde) o como una sola jornada continua (entrada y salida).
- Las horas se almacenarán en formato HH:MM exacto sin conversiones en este punto.

### 1.3 Gestión de Horas Extra
- El sistema calculará automáticamente las horas extra comparando las horas registradas con la jornada laboral fija.
- Las horas extra se almacenan internamente en formato HH:MM (sin redondeo).
- Las horas extra deberán clasificarse según la ley laboral colombiana: Diurna, Nocturna, Dominical/Festiva, Extra Diurna Dominical/Festiva, Extra Nocturna Dominical/Festiva.
- El Jefe tendrá una interfaz específica para aprobar horas extra utilizando un formato corporativo.
- Una vez aprobadas, el sistema generará un documento Word o PDF incluyendo firma digital del Jefe.

### 1.4 Reportes
- Los Coordinadores generan reportes quincenales del horario trabajado por cada operario.
- Los reportes enviados a Talento Humano deben mostrar las horas extra en formato decimal (por ejemplo, 1:15 → 1.25 horas).
- La conversión HH:MM → Decimal se realiza únicamente en el reporte, no en el almacenamiento interno.
- Se podrán generar reportes por empleado, área o rango de fechas.

### 1.5 Interfaz de Trabajador / Operario
- El operario solo puede visualizar sus jornadas, horas extra y reportes generados por su coordinador.
- No puede modificar registros ni ver información de otros empleados.

### 1.6 Apelaciones
- Si un operario considera incorrecto algún registro, podrá enviar una apelación desde su interfaz.
- La apelación notificará tanto a Talento Humano como al Coordinador correspondiente.

### 1.7 Parámetros Configurables (Talento Humano)
- Talento Humano podrá definir un salario mínimo predeterminado con un botón para aplicarlo al crear perfiles.
- Talento Humano podrá configurar multiplicadores para cada tipo de hora extra y recargo autorizado por ley.

### 1.8 Reglas de Seguridad y Acceso
- Cada usuario solo puede ver la información correspondiente a su rol.
- Los cambios de datos laborales deben quedar registrados en historial de auditoría.

## 2. Historias de Usuario
- Como Coordinador, quiero registrar jornadas manuales para corregir inconsistencias.
- Como Jefe, quiero aprobar horas extra mediante una interfaz con formato oficial.
- Como Talento Humano, quiero recibir reportes quincenales con horas extra en formato decimal.
- Como Operario, quiero poder enviar una apelación si una hora registrada es incorrecta.

## 3. Consideraciones Técnicas y de Cálculo
- El sistema almacenará horas y horas extra en formato HH:MM exacto.
- La conversión a formato decimal se hará únicamente al generar reportes para Talento Humano.
- El sistema debe permitir aplicar multiplicadores configurados para cálculo de valor monetario según ley laboral.
