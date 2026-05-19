/**
 * Cloudflare Worker — Validador de licencias Lemon Squeezy
 *
 * INSTRUCCIONES DE DESPLIEGUE:
 * 1. Creá cuenta gratis en https://workers.cloudflare.com
 * 2. Creá un nuevo Worker (dashboard → Workers → Create)
 * 3. Pegá este código en el editor
 * 4. En "Settings → Variables", agregá:
 *    - ALLOWED_ORIGIN = https://leosclaudia.github.io
 * 5. Guardá y desplegá
 * 6. Copiá la URL del worker (ej: billboard-validate.tuusuario.workers.dev)
 * 7. En app/index.html reemplazá VALIDATE_URL con esa URL + "/validate"
 *    Ejemplo: https://billboard-validate.tuusuario.workers.dev/validate
 *
 * NOTA: No necesitás API key de Lemon Squeezy para validar licencias públicas.
 * La validación usa el endpoint público de LS que no requiere autenticación.
 */

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || 'https://leosclaudia.github.io';

    // Manejar preflight CORS
    if (request.method === 'OPTIONS') {
      return corsResp(null, 200, origin);
    }

    // Solo POST en /validate
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/validate') {
      return corsResp(JSON.stringify({ valid: false, error: 'Not found' }), 404, origin);
    }

    let key;
    try {
      const body = await request.json();
      key = (body.key || '').trim();
    } catch {
      return corsResp(JSON.stringify({ valid: false, error: 'Invalid JSON' }), 400, origin);
    }

    if (!key) {
      return corsResp(JSON.stringify({ valid: false, error: 'Missing key' }), 400, origin);
    }

    try {
      // Validar contra Lemon Squeezy
      const lsResp = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          license_key: key,
          instance_name: 'browser-' + Date.now(),
        }),
      });

      const data = await lsResp.json();

      // Una licencia es válida si:
      // - data.valid === true
      // - el status es 'active' (suscripción activa) o la licencia es de tipo lifetime
      const status = data.license_key?.status;
      const isValid = data.valid === true && (status === 'active' || status === 'inactive');

      return corsResp(JSON.stringify({
        valid: isValid,
        status: status,
        email: data.meta?.customer_email || null,
      }), 200, origin);

    } catch (err) {
      return corsResp(JSON.stringify({
        valid: false,
        error: 'Validation service error: ' + err.message,
      }), 500, origin);
    }
  },
};

function corsResp(body, status, origin) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
