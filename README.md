# Mis Finanzas 💰

App web instalable (PWA) para administrar **ingresos, gastos, deudas y metas de ahorro**, en el celular y en el PC, con los datos sincronizados en Supabase.

## Funcionalidades

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
├── domain/calculos.js     Reglas de negocio puras (sin red ni DOM)
├── data/repositories.js   Acceso a datos (patrón Repository)
├── services/              Casos de uso (AuthService, FinanzasService)
├── ui/dom.js              Componentes de UI reutilizables
├── ui/views/              Pantallas (resumen, movimientos, deudas, metas, auth)
└── app.js                 Composition root + enrutador por hash
```

Principios SOLID aplicados:

| Principio | Dónde |
|---|---|
| **S**: Responsabilidad única | Cada capa tiene un solo motivo de cambio: cálculo (`domain`), persistencia (`data`), orquestación (`services`) y presentación (`ui`). |
| **O**: Abierto/cerrado | Las secciones se registran en el mapa `RUTAS` de `app.js`, y los repositorios nuevos extienden `BaseRepository` sin modificarlo. |
| **L**: Sustitución de Liskov | `MovimientosRepository` se usa donde se espera un `BaseRepository`. |
| **I**: Segregación de interfaces | Las vistas reciben solo `{ service, irA }`, y la autenticación está separada en `AuthService`. |
| **D**: Inversión de dependencias | `FinanzasService` recibe los repositorios inyectados y no conoce Supabase. Solo `app.js` arma las dependencias. |

## Base de datos (Supabase / PostgreSQL)

Tablas: `movimientos`, `deudas`, `pagos_deuda`, `metas`, `aportes_meta`. Todas tienen:
- `user_id` por defecto `auth.uid()`, con políticas RLS de select, insert, update y delete limitadas al dueño.
- Restricciones `CHECK` (montos positivos, tipos válidos) e índices por usuario y por llave foránea.
- Políticas restrictivas que impiden asociar un pago o aporte a una deuda o meta de otro usuario.

## Calidad

- Pruebas unitarias del dominio: `npm test` (Node 20+ con `node:test`).
- El texto del usuario se inserta siempre como `textNode`, sin `innerHTML`, para evitar XSS.
- Accesibilidad: elementos semánticos, `aria-*` en barras de progreso, foco visible y soporte de `prefers-reduced-motion`.

## Correr localmente

```bash
npx serve .        # o: python -m http.server 8080
npm test
```
