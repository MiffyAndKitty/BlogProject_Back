import { app } from '../app';
import '../config/env';
import request from 'supertest';
import { faker } from '@faker-js/faker';

describe('Local AuthenticationFlow', () => {
  let authToken: string | null = null;

  const fakeUser = {
    email: faker.internet.email(),
    password: faker.internet.password() + 'a1!',
    nickname: 'test-' + faker.internet.userName()
  };

  it('사용자 정보를 전달하면 회원가입 완료 결과를 받는다.', async () => {
    const response = await request(app).post('/api/auth/sign').send(fakeUser);

    expect(response.status).toBe(200);
    expect(response.body.result).toBe(true);
  });

  it('로그인 시, 유효한 유저이면 토큰을 발급 받는다', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: fakeUser.email,
      password: fakeUser.password
    });

    expect(response.status).toBe(200);
    expect(response.headers['authorization']).toBeDefined();
    expect(response.body.result).toBe(true);
    expect(response.body.data).toBe(fakeUser.nickname);

    // 인증 토큰 저장
    authToken = response.headers['authorization'];
    expect(authToken).not.toBeNull();
  });

  it('로그아웃을 성공하면 토큰이 삭제된다.', async () => {
    if (!authToken) {
      throw new Error('Authentication token is not available');
    }

    const response = await request(app)
      .get('/api/auth/logout')
      .set('Authorization', authToken);

    expect(response.status).toBe(200);
    expect(response.headers['authorization']).toBe('');
    expect(response.body.result).toBe(true);
  });
});
