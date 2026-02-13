import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters';
import { DataSource } from 'typeorm';

describe('Drone Delivery API (E2E)', () => {
  let app: INestApplication;

  // Tokens for different roles
  let adminToken: string;
  let enduserToken: string;
  let droneToken: string;
  let drone2Token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    // Clear all tables to ensure a clean state between test runs
    const dataSource = app.get(DataSource);
    const entities = dataSource.entityMetadatas;
    for (const entity of entities) {
      const repository = dataSource.getRepository(entity.name);
      await repository.clear();
    }
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── AUTH ───────────────────────────────────────────────

  describe('Auth - POST /auth/token', () => {
    it('should generate a token for admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/token')
        .send({ name: 'admin-user', type: 'admin' })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      adminToken = res.body.accessToken;
    });

    it('should generate a token for enduser', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/token')
        .send({ name: 'user-alice', type: 'enduser' })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      enduserToken = res.body.accessToken;
    });

    it('should generate a token for drone', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/token')
        .send({ name: 'drone-alpha', type: 'drone' })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      droneToken = res.body.accessToken;
    });

    it('should generate a token for second drone', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/token')
        .send({ name: 'drone-beta', type: 'drone' })
        .expect(200);

      drone2Token = res.body.accessToken;
    });

    it('should reject invalid type', async () => {
      await request(app.getHttpServer())
        .post('/auth/token')
        .send({ name: 'test', type: 'invalid' })
        .expect(400);
    });

    it('should reject missing name', async () => {
      await request(app.getHttpServer())
        .post('/auth/token')
        .send({ type: 'admin' })
        .expect(400);
    });
  });

  // ─── ROLE-BASED ACCESS CONTROL ─────────────────────────

  describe('RBAC Guards', () => {
    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer()).get('/orders').expect(401);
    });

    it('should reject drone accessing enduser endpoints', async () => {
      await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${droneToken}`)
        .expect(403);
    });

    it('should reject enduser accessing drone endpoints', async () => {
      await request(app.getHttpServer())
        .post('/drones/jobs/reserve')
        .set('Authorization', `Bearer ${enduserToken}`)
        .expect(403);
    });

    it('should reject enduser accessing admin endpoints', async () => {
      await request(app.getHttpServer())
        .get('/admin/orders')
        .set('Authorization', `Bearer ${enduserToken}`)
        .expect(403);
    });
  });

  // ─── FULL ORDER LIFECYCLE ──────────────────────────────

  describe('Full Order Lifecycle: Submit → Reserve → Grab → Deliver', () => {
    let orderId: string;
    let jobId: string;

    it('enduser: should submit an order', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${enduserToken}`)
        .send({
          originLat: 24.7136,
          originLng: 46.6753,
          destLat: 21.3891,
          destLng: 39.8579,
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('pending');
      orderId = res.body.id;
    });

    it('enduser: should see the order in their list', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${enduserToken}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body.some((o: any) => o.id === orderId)).toBe(true);
    });

    it('drone: should send heartbeat', async () => {
      const res = await request(app.getHttpServer())
        .patch('/drones/heartbeat')
        .set('Authorization', `Bearer ${droneToken}`)
        .send({ latitude: 24.7, longitude: 46.67 })
        .expect(200);

      expect(res.body.status).toBe('idle');
      expect(res.body.latitude).toBe(24.7);
    });

    it('drone: should reserve a job', async () => {
      const res = await request(app.getHttpServer())
        .post('/drones/jobs/reserve')
        .set('Authorization', `Bearer ${droneToken}`)
        .expect(200);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('reserved');
      jobId = res.body.id;
    });

    it('drone: should not reserve another job while active', async () => {
      await request(app.getHttpServer())
        .post('/drones/jobs/reserve')
        .set('Authorization', `Bearer ${droneToken}`)
        .expect(409);
    });

    it('drone: should grab the order', async () => {
      const res = await request(app.getHttpServer())
        .post(`/drones/jobs/${jobId}/grab`)
        .set('Authorization', `Bearer ${droneToken}`)
        .expect(200);

      expect(res.body.status).toBe('in_progress');
    });

    it('drone: should see current order details', async () => {
      const res = await request(app.getHttpServer())
        .get('/drones/current-order')
        .set('Authorization', `Bearer ${droneToken}`)
        .expect(200);

      expect(res.body.order.id).toBe(orderId);
      expect(res.body.job.status).toBe('in_progress');
    });

    it('enduser: should see order in progress with location', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${enduserToken}`)
        .expect(200);

      expect(res.body.order.status).toBe('in_progress');
      expect(res.body.progress.droneLocation).toBeDefined();
      expect(res.body.progress.etaMinutes).toBeGreaterThan(0);
    });

    it('drone: should mark order as delivered', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/drones/jobs/${jobId}/complete`)
        .set('Authorization', `Bearer ${droneToken}`)
        .send({ result: 'delivered' })
        .expect(200);

      expect(res.body.status).toBe('completed');
    });

    it('enduser: should see order as delivered', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${enduserToken}`)
        .expect(200);

      expect(res.body.order.status).toBe('delivered');
    });
  });

  // ─── WITHDRAW ORDER ────────────────────────────────────

  describe('Order Withdrawal', () => {
    let withdrawOrderId: string;

    it('should submit and withdraw a pending order', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${enduserToken}`)
        .send({
          originLat: 24.0,
          originLng: 46.0,
          destLat: 21.0,
          destLng: 39.0,
        })
        .expect(201);

      withdrawOrderId = res.body.id;

      const delRes = await request(app.getHttpServer())
        .delete(`/orders/${withdrawOrderId}`)
        .set('Authorization', `Bearer ${enduserToken}`)
        .expect(200);

      expect(delRes.body.status).toBe('withdrawn');
    });

    it('should reject withdrawing an already withdrawn order', async () => {
      await request(app.getHttpServer())
        .delete(`/orders/${withdrawOrderId}`)
        .set('Authorization', `Bearer ${enduserToken}`)
        .expect(400);
    });
  });

  // ─── BROKEN DRONE HANDOFF FLOW ─────────────────────────

  describe('Broken Drone Handoff Flow', () => {
    let orderId: string;
    let job1Id: string;
    let handoffJobId: string;

    it('enduser: submit a new order', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${enduserToken}`)
        .send({
          originLat: 25.0,
          originLng: 47.0,
          destLat: 22.0,
          destLng: 40.0,
        })
        .expect(201);

      orderId = res.body.id;
    });

    it('drone-alpha: heartbeat, reserve, and grab', async () => {
      // Heartbeat
      await request(app.getHttpServer())
        .patch('/drones/heartbeat')
        .set('Authorization', `Bearer ${droneToken}`)
        .send({ latitude: 25.0, longitude: 47.0 })
        .expect(200);

      // Reserve
      const reserveRes = await request(app.getHttpServer())
        .post('/drones/jobs/reserve')
        .set('Authorization', `Bearer ${droneToken}`)
        .expect(200);

      job1Id = reserveRes.body.id;

      // Grab
      await request(app.getHttpServer())
        .post(`/drones/jobs/${job1Id}/grab`)
        .set('Authorization', `Bearer ${droneToken}`)
        .expect(200);
    });

    it('drone-alpha: update location (in transit)', async () => {
      await request(app.getHttpServer())
        .patch('/drones/heartbeat')
        .set('Authorization', `Bearer ${droneToken}`)
        .send({ latitude: 24.0, longitude: 45.0 })
        .expect(200);
    });

    it('drone-alpha: mark as broken → handoff job created', async () => {
      const res = await request(app.getHttpServer())
        .patch('/drones/status/broken')
        .set('Authorization', `Bearer ${droneToken}`)
        .expect(200);

      expect(res.body.drone.status).toBe('broken');
      expect(res.body.handoffJob).toBeDefined();
      expect(res.body.handoffJob.type).toBe('handoff');
      handoffJobId = res.body.handoffJob.id;
    });

    it('enduser: should see order as pending_handoff', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${enduserToken}`)
        .expect(200);

      expect(res.body.order.status).toBe('pending_handoff');
    });

    it('drone-beta: heartbeat', async () => {
      await request(app.getHttpServer())
        .patch('/drones/heartbeat')
        .set('Authorization', `Bearer ${drone2Token}`)
        .send({ latitude: 23.5, longitude: 44.5 })
        .expect(200);
    });

    it('drone-beta: reserve the handoff job', async () => {
      const res = await request(app.getHttpServer())
        .post('/drones/jobs/reserve')
        .set('Authorization', `Bearer ${drone2Token}`)
        .expect(200);

      expect(res.body.id).toBe(handoffJobId);
      expect(res.body.type).toBe('handoff');
    });

    it('drone-beta: grab and deliver', async () => {
      // Grab
      await request(app.getHttpServer())
        .post(`/drones/jobs/${handoffJobId}/grab`)
        .set('Authorization', `Bearer ${drone2Token}`)
        .expect(200);

      // Deliver
      const res = await request(app.getHttpServer())
        .patch(`/drones/jobs/${handoffJobId}/complete`)
        .set('Authorization', `Bearer ${drone2Token}`)
        .send({ result: 'delivered' })
        .expect(200);

      expect(res.body.status).toBe('completed');
    });

    it('enduser: should see order as delivered', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${enduserToken}`)
        .expect(200);

      expect(res.body.order.status).toBe('delivered');
    });
  });

  // ─── ADMIN ENDPOINTS ───────────────────────────────────

  describe('Admin Endpoints', () => {
    it('admin: should list all orders in bulk', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    });

    it('admin: should filter orders by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/orders?status=delivered')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      res.body.data.forEach((order: any) => {
        expect(order.status).toBe('delivered');
      });
    });

    it('admin: should paginate orders', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/orders?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(2);
    });

    it('admin: should list drones', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/drones')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('admin: should update order location', async () => {
      // Get first order
      const ordersRes = await request(app.getHttpServer())
        .get('/admin/orders?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Find a non-delivered/withdrawn order, or use the first one for negative testing
      const pendingRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${enduserToken}`)
        .send({
          originLat: 24.0,
          originLng: 46.0,
          destLat: 21.0,
          destLng: 39.0,
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/admin/orders/${pendingRes.body.id}/location`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ destLat: 23.5, destLng: 41.0 })
        .expect(200);

      expect(res.body.destLat).toBe(23.5);
      expect(res.body.destLng).toBe(41.0);

      // Clean up — withdraw this order so its OPEN job doesn't interfere with later tests
      await request(app.getHttpServer())
        .delete(`/orders/${pendingRes.body.id}`)
        .set('Authorization', `Bearer ${enduserToken}`)
        .expect(200);
    });

    it('admin: should mark broken drone as fixed', async () => {
      // Get drones to find the broken one
      const dronesRes = await request(app.getHttpServer())
        .get('/admin/drones')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const brokenDrone = dronesRes.body.find((d: any) => d.status === 'broken');
      if (brokenDrone) {
        const res = await request(app.getHttpServer())
          .patch(`/admin/drones/${brokenDrone.id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: 'fixed' })
          .expect(200);

        expect(res.body.drone.status).toBe('idle');
      }
    });

    it('admin: should not update location of delivered order', async () => {
      const ordersRes = await request(app.getHttpServer())
        .get('/admin/orders?status=delivered')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      if (ordersRes.body.data.length > 0) {
        await request(app.getHttpServer())
          .patch(`/admin/orders/${ordersRes.body.data[0].id}/location`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ destLat: 23.5 })
          .expect(400);
      }
    });
  });

  // ─── EDGE CASES ────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should reject order withdrawal after pickup', async () => {
      // Submit order
      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${enduserToken}`)
        .send({
          originLat: 24.0,
          originLng: 46.0,
          destLat: 21.0,
          destLng: 39.0,
        })
        .expect(201);

      // Drone reserves
      const reserveRes = await request(app.getHttpServer())
        .post('/drones/jobs/reserve')
        .set('Authorization', `Bearer ${droneToken}`)
        .expect(200);

      // Drone grabs
      await request(app.getHttpServer())
        .post(`/drones/jobs/${reserveRes.body.id}/grab`)
        .set('Authorization', `Bearer ${droneToken}`)
        .expect(200);

      // Try to withdraw — should fail
      await request(app.getHttpServer())
        .delete(`/orders/${orderRes.body.id}`)
        .set('Authorization', `Bearer ${enduserToken}`)
        .expect(400);

      // Clean up — deliver
      await request(app.getHttpServer())
        .patch(`/drones/jobs/${reserveRes.body.id}/complete`)
        .set('Authorization', `Bearer ${droneToken}`)
        .send({ result: 'delivered' })
        .expect(200);
    });

    it('should prevent other user from viewing orders', async () => {
      // Create second enduser
      const user2Res = await request(app.getHttpServer())
        .post('/auth/token')
        .send({ name: 'user-bob', type: 'enduser' })
        .expect(200);

      // user-bob tries to get user-alice orders
      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${user2Res.body.accessToken}`)
        .expect(200);

      // Should have 0 orders (user-bob has none)
      expect(res.body.length).toBe(0);
    });

    it('should reject grabbing a job assigned to another drone', async () => {
      // Submit order
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${enduserToken}`)
        .send({
          originLat: 24.0,
          originLng: 46.0,
          destLat: 21.0,
          destLng: 39.0,
        })
        .expect(201);

      // Drone alpha reserves
      const reserveRes = await request(app.getHttpServer())
        .post('/drones/jobs/reserve')
        .set('Authorization', `Bearer ${droneToken}`)
        .expect(200);

      // Drone beta tries to grab alpha's job
      await request(app.getHttpServer())
        .post(`/drones/jobs/${reserveRes.body.id}/grab`)
        .set('Authorization', `Bearer ${drone2Token}`)
        .expect(400);

      // Clean up
      await request(app.getHttpServer())
        .post(`/drones/jobs/${reserveRes.body.id}/grab`)
        .set('Authorization', `Bearer ${droneToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/drones/jobs/${reserveRes.body.id}/complete`)
        .set('Authorization', `Bearer ${droneToken}`)
        .send({ result: 'delivered' })
        .expect(200);
    });

    it('should validate coordinate bounds', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${enduserToken}`)
        .send({
          originLat: 200, // invalid
          originLng: 46.0,
          destLat: 21.0,
          destLng: 39.0,
        })
        .expect(400);
    });
  });
});
