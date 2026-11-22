// Configuración pública del proyecto Supabase.
// La clave "publishable" está hecha para usarse en el navegador:
// la seguridad real la dan las políticas RLS de la base de datos.
export const SUPABASE_URL = 'https://pvvjmgaielymmppyqzzp.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_x5RCm0L-HXC-TfE-gaUqUg_dPenF40l';

export const CATEGORIAS = {
  ingreso: ['Trabajo por horas', 'Salario', 'Freelance', 'Ventas', 'Regalo', 'Beca', 'Otros'],
  gasto: ['Comida', 'Transporte', 'Universidad', 'Servicios', 'Celular e internet', 'Entretenimiento',
    'Ropa', 'Salud', 'Tecnología', 'Hogar', 'Pago de deudas', 'Otros'],
};

export const ICONOS_META = ['🎯', '💻', '📱', '🎮', '🏍️', '🚗', '✈️', '🏠', '🎧', '👟', '📚', '💍', '🎁', '💰'];

// Clave pública VAPID para notificaciones push (la privada está en el Vault de Supabase).
export const VAPID_PUBLIC = 'BGijW804IPSA87yqZj8l-MqT_AhLpmTF_EAHi5oTKvhcyfD64PeINHycS71yC0xnBjM4I84vZTddhh_5DGD6JdI';
