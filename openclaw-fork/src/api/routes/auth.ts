import { FastifyInstance } from 'fastify';
import { UserService } from '../../users/service.js';
import { Authenticator } from '../../auth/authenticator.js';
import { authenticateUser, requireAdmin } from '../../auth/middleware.js';

const userService = new UserService();

export async function authRoutes(app: FastifyInstance): Promise<void> {

  // ===== PUBLIC ROUTES =====

  /**
   * POST /api/auth/setup — Bootstrap first admin (only works when no users exist)
   */
  app.post('/api/auth/setup', async (request, reply) => {
    const users = userService.getAllUsers();
    if (users.length > 0) {
      return reply.code(403).send({ error: 'Setup already completed. Use /api/auth/register to create additional users.' });
    }

    const { email, username, password, displayName } = request.body as {
      email: string;
      username: string;
      password: string;
      displayName?: string;
    };

    if (!email || !username || !password) {
      return reply.code(400).send({ error: 'Email, username, and password required' });
    }

    if (password.length < 8) {
      return reply.code(400).send({ error: 'Password must be at least 8 characters' });
    }

    const user = await userService.createUser({ email, username, password, isAdmin: true, displayName });
    const session = userService.createSession(user.id);

    return {
      message: 'Admin account created successfully',
      token: session.token,
      expiresAt: session.expires_at,
      user
    };
  });

  /**
   * POST /api/auth/login
   * Step 1: Validate credentials. If 2FA enabled, returns { requires2FA: true, tempToken }
   * Step 2 (if 2FA): Client calls /api/auth/verify-2fa with tempToken + TOTP code
   */
  app.post('/api/auth/login', async (request, reply) => {
    const { login, password } = request.body as { login: string; password: string };

    if (!login || !password) {
      return reply.code(400).send({ error: 'Login and password required' });
    }

    const user = await userService.authenticate(login, password);
    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    // If 2FA is enabled, require verification
    if (user.totp_enabled) {
      const tempSession = userService.createSession(user.id);
      return {
        requires2FA: true,
        tempToken: tempSession.token,
        message: 'Enter your 2FA code to complete login'
      };
    }

    // No 2FA — issue full session
    const session = userService.createSession(user.id);
    return {
      token: session.token,
      expiresAt: session.expires_at,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isAdmin: user.is_admin === 1,
        displayName: user.display_name
      }
    };
  });

  /**
   * POST /api/auth/verify-2fa
   */
  app.post('/api/auth/verify-2fa', async (request, reply) => {
    const { tempToken, code } = request.body as { tempToken: string; code: string };

    if (!tempToken || !code) {
      return reply.code(400).send({ error: 'Temp token and 2FA code required' });
    }

    const user = userService.validateSession(tempToken);
    if (!user) {
      return reply.code(401).send({ error: 'Invalid or expired temp token' });
    }

    if (!user.totp_secret) {
      return reply.code(400).send({ error: '2FA not configured for this user' });
    }

    const valid = Authenticator.verify(code, user.totp_secret);
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid 2FA code' });
    }

    userService.destroySession(tempToken);
    const session = userService.createSession(user.id);

    return {
      token: session.token,
      expiresAt: session.expires_at,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isAdmin: user.is_admin === 1,
        displayName: user.display_name
      }
    };
  });

  // ===== AUTHENTICATED ROUTES =====

  app.get('/api/auth/me', { preHandler: [authenticateUser] }, async (request) => {
    const user = request.currentUser!;
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isAdmin: user.is_admin === 1,
        totpEnabled: user.totp_enabled === 1,
        displayName: user.display_name,
        createdAt: user.created_at
      }
    };
  });

  app.post('/api/auth/setup-2fa', { preHandler: [authenticateUser] }, async (request) => {
    const user = request.currentUser!;
    const setup = await Authenticator.setup(user.username);
    return {
      secret: setup.secret,
      qrCode: setup.qrCodeDataUrl,
      message: 'Scan QR code with authenticator app, then call /api/auth/confirm-2fa with a code to enable'
    };
  });

  app.post('/api/auth/confirm-2fa', { preHandler: [authenticateUser] }, async (request, reply) => {
    const { secret, code } = request.body as { secret: string; code: string };
    const user = request.currentUser!;

    if (!secret || !code) {
      return reply.code(400).send({ error: 'Secret and code required' });
    }

    const valid = Authenticator.verify(code, secret);
    if (!valid) {
      return reply.code(400).send({ error: 'Invalid code. Make sure your authenticator app is synced.' });
    }

    userService.enableTotp(user.id, secret);
    return { enabled: true, message: '2FA enabled successfully' };
  });

  app.post('/api/auth/disable-2fa', { preHandler: [authenticateUser] }, async (request, reply) => {
    const { code } = request.body as { code: string };
    const user = request.currentUser!;

    if (!user.totp_enabled || !user.totp_secret) {
      return reply.code(400).send({ error: '2FA is not enabled' });
    }

    const valid = Authenticator.verify(code, user.totp_secret);
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid 2FA code' });
    }

    userService.disableTotp(user.id);
    return { disabled: true, message: '2FA disabled' };
  });

  app.post('/api/auth/logout', { preHandler: [authenticateUser] }, async (request) => {
    const token = request.headers.authorization!.slice(7);
    userService.destroySession(token);
    return { loggedOut: true };
  });

  app.post('/api/auth/change-password', { preHandler: [authenticateUser] }, async (request, reply) => {
    const { currentPassword, newPassword } = request.body as { currentPassword: string; newPassword: string };
    const user = request.currentUser!;

    if (!currentPassword || !newPassword) {
      return reply.code(400).send({ error: 'Current and new password required' });
    }

    if (newPassword.length < 8) {
      return reply.code(400).send({ error: 'Password must be at least 8 characters' });
    }

    const authed = await userService.authenticate(user.email, currentPassword);
    if (!authed) {
      return reply.code(401).send({ error: 'Current password is incorrect' });
    }

    await userService.changePassword(user.id, newPassword);
    return { changed: true };
  });

  // ===== ADMIN ROUTES =====

  app.post('/api/auth/register', { preHandler: [authenticateUser, requireAdmin] }, async (request, reply) => {
    const { email, username, password, isAdmin, displayName } = request.body as {
      email: string;
      username: string;
      password: string;
      isAdmin?: boolean;
      displayName?: string;
    };

    if (!email || !username || !password) {
      return reply.code(400).send({ error: 'Email, username, and password required' });
    }

    if (password.length < 8) {
      return reply.code(400).send({ error: 'Password must be at least 8 characters' });
    }

    try {
      const user = await userService.createUser({ email, username, password, isAdmin, displayName });
      return { user };
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) {
        return reply.code(409).send({ error: 'Email or username already exists' });
      }
      throw err;
    }
  });

  app.get('/api/auth/users', { preHandler: [authenticateUser, requireAdmin] }, async () => {
    const users = userService.getAllUsers();
    return { users, count: users.length };
  });

  app.delete('/api/auth/users/:id', { preHandler: [authenticateUser, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = userService.getUserById(id);
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }
    userService.deleteUser(id);
    return { deleted: true };
  });
}
