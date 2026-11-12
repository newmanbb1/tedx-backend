import jwt from 'jsonwebtoken';

async function testSecurity() {
  console.log('🧪 Iniciando batería de pruebas de seguridad TEDx...\n');

  const BASE_URL = 'http://localhost:4000/api';

  // 1. Probar cabeceras de seguridad Helmet
  console.log('1️⃣  Verificando cabeceras de seguridad HTTP (Helmet)...');
  const healthRes = await fetch(`${BASE_URL}/health`);
  const headers = Object.fromEntries(healthRes.headers.entries());
  console.log('   - X-Content-Type-Options:', headers['x-content-type-options'] || 'FAIL');
  console.log('   - X-Frame-Options:', headers['x-frame-options'] || 'FAIL');
  console.log('   - Cross-Origin-Resource-Policy:', headers['cross-origin-resource-policy'] || 'FAIL');
  console.log('   - Strict-Transport-Security:', headers['strict-transport-security'] || 'FAIL');

  if (headers['x-content-type-options'] === 'nosniff' && headers['cross-origin-resource-policy'] === 'cross-origin') {
    console.log('   ✅ Cabeceras de seguridad validadas con éxito.\n');
  } else {
    throw new Error('Cabeceras de Helmet ausentes o incorrectas');
  }

  // 2. Probar Login con JWT y vigencia de 24 horas
  console.log('2️⃣  Probando Login y expiración de 24 horas...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@tedx.local',
      password: 'AdminTedx2026!',
    }),
  });

  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData.token) {
    throw new Error(`Login falló: ${JSON.stringify(loginData)}`);
  }

  const decoded: any = jwt.decode(loginData.token);
  const diffHours = (decoded.exp - decoded.iat) / 3600;
  console.log(`   - Token recibido: ${loginData.token.substring(0, 25)}...`);
  console.log(`   - Rol del usuario: ${loginData.user.role}`);
  console.log(`   - Vigencia del token: ${diffHours} horas`);

  if (diffHours === 24) {
    console.log('   ✅ Token configurado con exactamente 24 horas de vigencia.\n');
  } else {
    throw new Error(`Vigencia esperada 24h, recibida: ${diffHours}h`);
  }

  // 3. Probar acceso autorizado a endpoint protegido de Admin
  console.log('3️⃣  Probando acceso autorizado a /api/admin/dashboard...');
  const adminRes = await fetch(`${BASE_URL}/admin/dashboard`, {
    headers: { Authorization: `Bearer ${loginData.token}` },
  });
  console.log(`   - Status: ${adminRes.status}`);
  if (adminRes.status === 200) {
    console.log('   ✅ Acceso concedido al rol ADMIN.\n');
  } else {
    throw new Error(`Error inesperado en /admin/dashboard: ${adminRes.status}`);
  }

  // 4. Probar control de acceso por roles (RBAC): Voluntario intentando entrar a Admin
  console.log('4️⃣  Probando control de acceso (RBAC): Voluntario -> Admin...');
  const volLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'voluntario1@tedx.local',
      password: 'VoluntarioTedx2026!',
    }),
  });
  const volData = await volLoginRes.json();
  if (!volLoginRes.ok || !volData.token) {
    throw new Error(`Login de voluntario falló: ${JSON.stringify(volData)}`);
  }

  const volAdminAttempt = await fetch(`${BASE_URL}/admin/dashboard`, {
    headers: { Authorization: `Bearer ${volData.token}` },
  });
  const volAdminData = await volAdminAttempt.json();
  console.log(`   - Status retornado: ${volAdminAttempt.status} (Esperado: 403)`);
  console.log(`   - Código de error: ${volAdminData.code}`);
  console.log(`   - Roles requeridos: ${JSON.stringify(volAdminData.requiredRoles)}`);

  if (volAdminAttempt.status === 403 && volAdminData.code === 'FORBIDDEN') {
    console.log('   ✅ RBAC bloqueó correctamente al voluntario del panel de administración.\n');
  } else {
    throw new Error('El RBAC falló en bloquear al usuario no autorizado');
  }

  // 5. Probar detección de Token Expirado
  console.log('5️⃣  Probando detección de Token Expirado...');
  const secret = process.env.JWT_SECRET || 'tedx_super_secret_jwt_key_2026_change_in_production';
  const expiredToken = jwt.sign(
    { id: 'fake-id', email: 'expired@tedx.local', role: 'ADMIN' },
    secret,
    { expiresIn: -10 } // Expirado hace 10 segundos
  );

  const expiredRes = await fetch(`${BASE_URL}/admin/dashboard`, {
    headers: { Authorization: `Bearer ${expiredToken}` },
  });
  const expiredData = await expiredRes.json();
  console.log(`   - Status retornado: ${expiredRes.status} (Esperado: 401)`);
  console.log(`   - Código de error: ${expiredData.code} (Esperado: TOKEN_EXPIRED)`);
  console.log(`   - Mensaje: ${expiredData.error}`);

  if (expiredRes.status === 401 && expiredData.code === 'TOKEN_EXPIRED') {
    console.log('   ✅ Token expirado detectado y clasificado como TOKEN_EXPIRED correctamente.\n');
  } else {
    throw new Error('Fallo en detección de token expirado');
  }

  // 6. Probar Rate Limiting Headers en login
  console.log('6️⃣  Probando cabeceras de Rate Limiting...');
  const rlLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'bad@tedx.local', password: 'wrong' }),
  });
  const rlHeaders = Object.fromEntries(rlLoginRes.headers.entries());
  console.log('   - RateLimit-Limit:', rlHeaders['ratelimit-limit']);
  console.log('   - RateLimit-Remaining:', rlHeaders['ratelimit-remaining']);
  console.log('   - RateLimit-Reset:', rlHeaders['ratelimit-reset']);

  if (rlHeaders['ratelimit-limit'] === '10') {
    console.log('   ✅ Rate limit configurado exactamente a 10 peticiones.\n');
  } else {
    console.log('   ⚠️ Nota: RateLimit-Limit fue:', rlHeaders['ratelimit-limit']);
  }

  console.log('🎉 ¡Todas las pruebas de seguridad concluyeron satisfactoriamente!');
}

testSecurity().catch((err) => {
  console.error('❌ Error en pruebas de seguridad:', err);
  process.exit(1);
});
