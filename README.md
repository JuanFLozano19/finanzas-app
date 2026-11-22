# Rumbo 🧭

App web instalable (PWA) para gestionar tu vida desde el celular y el PC: **agenda, tareas, hábitos, rutinas, universidad, trabajo, salud, crecimiento personal y plata**. Los datos se sincronizan con Supabase, la app funciona sin internet y manda recordatorios con notificaciones push.

## Módulos

**Mi día**
- **Hoy:** saludo, avisos (pagos que vencen, cumpleaños, préstamos), rutina pendiente, hábitos, agenda, tareas, evaluaciones próximas y lo que te deben del trabajo.
- **Modo enfoque:** solo tus 3 tareas más importantes de hoy y lo siguiente en tu agenda.
- **Agenda:** vista semanal con clases, turnos, citas y entregas. Los eventos pueden repetirse cada semana.
- **Tareas:** prioridad, fecha y materia, agrupadas en vencidas, hoy, próximas y sin fecha.
- **Hábitos:** días de la semana, rachas y % de cumplimiento.
- **Rutinas:** listas de mañana y de noche que se reinician cada día.
- **Diario y notas:** notas con búsqueda y fijado, y diario con estado de ánimo.

**Universidad**
- **Materias:** evaluaciones ponderadas (escala 0–5), nota necesaria para pasar con 3.0, promedio por créditos y 🔮 simulador de notas.
- **Horario:** las clases se agregan una vez y se repiten hasta el fin del semestre.
- **Apuntes:** texto, enlaces y archivos (PDF, fotos) por materia, guardados en un Storage privado.
- **Trabajos en grupo:** integrantes, partes con responsable y avance. Tus partes aparecen en Tareas.
- **Pomodoro:** temporizador por materia que registra tus horas de estudio.

**Áreas**
- **Turnos de trabajo:** tipo de turno, descripción, hora de entrada y salida (incluye turnos de noche), turnos fijos semanales y horas por semana y mes. Avisa antes de cada turno (15 min a 2 h) y la noche anterior.
- **Salud:** agua, sueño, peso y entrenamientos con resumen semanal.

**Crecimiento**
- **Metas de vida** por pasos, **lectura y cursos**, **personas** (cumpleaños, WhatsApp y recordatorio de contacto) y **revisión semanal**.

**Plata**
- Resumen, movimientos (al registrar un ingreso propone repartirlo en tus metas), **cuentas y bolsillos**, **presupuestos** con alerta al 80%, **pagos fijos**, deudas, **préstamos** (lo que te deben), metas de ahorro, **lista de deseos** con historial de precios y regla de 30 días, **¿me lo puedo permitir?** y **estadísticas**.

**Transversales**
- ✨ **Asistente sin IA:** entiende frases como "gasté 15 mil en almuerzo", "trabajé 4 horas" o "parcial de bases el jueves a las 2". Se abre con el botón ✨ o con la tecla `/`.
- 🔔 **Notificaciones push** cada 15 minutos (Edge Function + pg_cron), configurables por tipo.
- 🔐 **Inicio con huella o rostro** (passkeys de Supabase, experimental).
- 📡 **Sin internet:** lecturas desde caché y cola de cambios que se sube sola al volver la conexión.
- 🎨 Tema claro/oscuro/automático y color de acento. 📤 Exportar todo a Excel.

## Diseño

Paleta "brújula de noche": azul noche `#13203D` para lo importante, cobalto `#2F55D4` como color principal (cambiable en Ajustes), naranja aguja `#FF7A1A` reservado para lo urgente (hoy, turno en curso), niebla `#EDF1F7` de fondo. Tipografías: Bricolage Grotesque para títulos y DM Sans para texto.

## Arquitectura

```
js/
├── app.js                   Composition root, rutas y navegación
├── config.js                Configuración pública y catálogos
├── core/                    Cliente Supabase, formato de fechas/plata, tema
├── domain/                  Reglas de negocio PURAS (sin red ni DOM), 100% probadas
│   ├── calculos.js          Finanzas básicas
│   ├── plata.js             Cuentas, presupuestos, fijos, deseos, reparto, permitirme
│   ├── vida.js              Hábitos, agenda, tareas, universidad, horas, salud
│   ├── bienestar.js         Cumpleaños, contactos, lectura, metas de vida
│   └── asistente.js         Intérprete de frases en español colombiano
├── data/
│   ├── repositories.js      Patrón Repository sobre Supabase
│   └── outbox.js            Cola sin conexión y fusión optimista
├── services/                Casos de uso, uno por contexto (Finanzas, Plata, Vida,
│                            Universidad, Bienestar, Asistente, Dispositivo)
└── ui/
    ├── dom.js               Primitivas (nodos seguros, formularios, diálogos)
    ├── components.js        Componentes compartidos
    ├── charts.js            Gráficas HTML accesibles (leyenda, tooltip, tabla)
    └── views/               Una pantalla por módulo
supabase/functions/notificar Edge Function de recordatorios push
```

| Principio SOLID | Dónde se aplica |
|---|---|
| **S**: Responsabilidad única | Dominio (reglas), datos (persistencia), servicios (casos de uso) y vistas (presentación) cambian por motivos distintos. Cada servicio cubre un solo contexto. |
| **O**: Abierto/cerrado | Un módulo nuevo se agrega registrándolo en `RUTAS`. Ajustes recibe secciones con `seccionesAjustes.push(...)` sin tocar su código. |
| **L**: Sustitución de Liskov | `MovimientosRepository` funciona donde se espera un `BaseRepository`, y `CrudService` se extiende sin romper el contrato. |
| **I**: Segregación de interfaces | Las vistas reciben solo los servicios que usan del contexto. La autenticación, las notificaciones y las passkeys van en servicios separados. |
| **D**: Inversión de dependencias | Los servicios reciben repositorios inyectados y no conocen Supabase. Solo `app.js` arma las dependencias. |

## Seguridad

- **RLS** en las 34 tablas: cada usuario solo lee y escribe lo suyo. Además hay políticas *restrictivas* que impiden referenciar registros de otro usuario.
- Los secretos (VAPID y cron) están en **Supabase Vault**. Solo la Edge Function los lee, mediante una función `security definer` limitada a `service_role`.
- Archivos en un bucket **privado** con carpeta por usuario y enlaces firmados de 2 minutos.
- El texto se inserta como `textNode`, sin `innerHTML`, para evitar XSS.

## Calidad

- **47 pruebas unitarias** del dominio, la cola sin conexión y el asistente: `npm test`.
- Pruebas visuales de humo (Playwright) en las 30 pantallas, en celular y escritorio.
- Asesores de Supabase revisados (seguridad y rendimiento).
- Accesibilidad: roles ARIA, foco visible, gráficas con tabla de datos y soporte de `prefers-reduced-motion`.

## Correr localmente

```bash
npx serve .        # o: python -m http.server 8080
npm test
```
