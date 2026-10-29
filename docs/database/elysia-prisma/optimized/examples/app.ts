// Minimal integration example, not the inventory API implementation.
import { Elysia } from 'elysia';
import { auth } from './auth';

export const app = new Elysia()
  .mount(auth.handler)
  .macro({
    authenticated: {
      async resolve({ status, request: { headers } }) {
        const current = await auth.api.getSession({ headers });
        if (!current) return status(401);
        if (!current.user.isActive) return status(403);
        return { user: current.user, session: current.session };
      },
    },
  })
  .get('/me', ({ user }) => ({ id: user.id, name: user.name }), {
    authenticated: true,
  });

// Before adding domain routes, resolve RuleSet/Group/Permission in a separate
// authorization guard. A valid session is not permission to access inventory.
// Cross-origin deployments also need an explicit credentialed CORS policy.
