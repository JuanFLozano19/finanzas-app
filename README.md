# Mi Vida 🧭

App web instalable (PWA) para gestionar tu vida desde el celular y el PC: **agenda, tareas, hábitos, diario y notas, universidad, trabajo por horas, salud y finanzas**, con los datos sincronizados en Supabase.

## Funcionalidades

- **Hoy:** tu día de un vistazo: agenda, tareas para hoy y vencidas, hábitos para marcar, balance del mes, horas por cobrar y próximas evaluaciones.
- **Agenda:** vista semanal con clases, turnos, citas y entregas. Los eventos pueden repetirse cada semana.
- **Tareas:** prioridad, fecha límite y materia, agrupadas en vencidas, hoy, próximas y sin fecha.
- **Hábitos:** días de la semana, rachas 🔥 y % de cumplimiento en 30 días.
- **Diario y notas:** notas con búsqueda y fijado, y diario con estado de ánimo.
- **Universidad:** materias con evaluaciones ponderadas (escala 0–5), nota acumulada, nota necesaria para pasar con 3.0 y promedio por créditos.
- **Trabajo:** registro de horas con tarifa. El botón "Ya me pagaron" crea el ingreso en Finanzas.
- **Salud:** agua del día, sueño, peso y entrenamientos con resumen semanal.

### Finanzas

- **Resumen:** balance del mes, total de deudas, ahorro en metas y gastos por categoría.
- **Movimientos:** registro de ingresos y gastos por mes, con filtros y categorías.
- **Deudas:** monto total, cuota, interés y fecha límite. Pagos con historial y cuotas restantes. Cada pago puede registrarse también como gasto.
- **Metas:** lo que quieres comprar, con precio y fecha. Calcula cuánto ahorrar al mes, permite aportes y retiros y marcar la meta como comprada.
- Inicio de sesión obligatorio. Cada usuario solo ve sus datos (Row Level Security).
- Instalable en Android, iPhone y escritorio. Tema claro y oscuro automático.

## Arquitectura

```
js/
├── config.js              Configuración pública y catálogos
├── core/                  Infraestructura (cliente Supabase, formato)
├── domain/calculos.js     Reglas de negocio de finanzas (puras)
├── domain/vida.js         Reglas de hábitos, agenda, tareas, notas, horas y salud (puras)
├── data/repositories.js   Acceso a datos (patrón Repository)
├── services/              Casos de uso (Auth, Finanzas y un servicio por módulo de vida)
├── ui/dom.js              Primitivas de UI (nodos, formularios, diálogos)
├── ui/components.js       Componentes compartidos (tarea, evento)
├── ui/views/              Una pantalla por módulo
└── app.js                 Composition root + enrutador por hash
```

Principios SOLID aplicados:

| Principio | Dónde |
|---|---|
| **S**: Responsabilidad única | Cada capa tiene un solo motivo de cambio: cálculo (`domain`), persistencia (`data`), orquestación (`services`) y presentación (`ui`). |
| **O**: Abierto/cerrado | Un módulo nuevo se agrega registrándolo en el mapa `RUTAS` de `app.js`. `CrudService` y `BaseRepository` se extienden sin modificarse. |
| **L**: Sustitución de Liskov | `MovimientosRepository` se usa donde se espera un `BaseRepository`. |
| **I**: Segregación de interfaces | Las vistas reciben solo `{ service, irA }`, y la autenticación está separada en `AuthService`. |
| **D**: Inversión de dependencias | `FinanzasService` recibe los repositorios inyectados y no conoce Supabase. Solo `app.js` arma las dependencias. |

## Base de datos (Supabase / PostgreSQL)

Tablas: `movimientos`, `deudas`, `pagos_deuda`, `metas`, `aportes_meta`, `tareas`, `habitos`, `registros_habito`, `eventos`, `notas`, `materias`, `evaluaciones`, `horas_trabajo`, `ajustes`, `entrenamientos` y `registros_salud`. Todas tienen:
- `user_id` por defecto `auth.uid()`, con políticas RLS de select, insert, update y delete limitadas al dueño.
- Restricciones `CHECK` (montos positivos, tipos válidos) e índices por usuario y por llave foránea.
- Políticas restrictivas que impiden referenciar registros de otro usuario (pagos, aportes, evaluaciones, hábitos, materias y movimientos).

## Calidad

- 18 pruebas unitarias del dominio: `npm test` (Node 20+ con `node:test`).
- El texto del usuario se inserta siempre como `textNode`, sin `innerHTML`, para evitar XSS.
- Accesibilidad: elementos semánticos, `aria-*` en barras de progreso, foco visible y soporte de `prefers-reduced-motion`.

## Correr localmente

```bash
npx serve .        # o: python -m http.server 8080
npm test
```
