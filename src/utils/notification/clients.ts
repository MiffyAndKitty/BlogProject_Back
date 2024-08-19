import { Response } from 'express';

export class clientsService {
  private static clients: Map<string, Response> = new Map();

  public static add(userId: string, res: Response) {
    this.clients.set(userId, res);
  }

  public static get(userId: string): Response | undefined {
    return this.clients.get(userId);
  }

  public static delete(userId: string) {
    this.clients.delete(userId);
  }

  public static getAll() {
    return this.clients;
  }
}
