/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from './route';
import { StatusCodes } from 'http-status-codes';
import { JsonResponse } from '@/lib/jsonResponse';
import { ModelFactory } from '@/lib/models';
import { SqliteMessageModel } from '@/lib/models/sqlite/message';

// Mock the model factory
jest.mock('@/lib/models', () => ({
  ModelFactory: {
    getInstance: jest.fn().mockReturnValue({
      getMessageModel: jest.fn()
    })
  }
}));

describe('Messages API', () => {
  let mockMessageModel: jest.Mocked<SqliteMessageModel>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockMessageModel = {
      list: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      timeSeries: jest.fn(),
      aggregate: jest.fn()
    } as any;
    (ModelFactory.getInstance().getMessageModel as jest.Mock).mockResolvedValue(mockMessageModel);
  });

  it('should return messages with default pagination', async () => {
    // Mock model responses
    mockMessageModel.list.mockResolvedValue({
      messages: [{
        messageId: 1,
        timestamp: '2024-02-20T12:00:00Z',
        userId: 'user1',
        source: 'arcade',
        payloadToolkit: 'test-toolkit',
        payloadToolVersion: '1.0.0',
        origin: 'client',
        payloadMessageId: 'msg1',
        payloadMethod: 'test.method',
        payloadToolName: 'test-tool',
        hasError: false,
        createdAt: '2024-02-20T12:00:00Z',
        alerts: false
      }],
      pagination: {
        total: 50,
        remaining: 0,
        hasMore: false,
        nextCursor: null,
        limit: 20,
        sort: 'desc'
      }
    });

    const request = new NextRequest('http://localhost:3000/api/v1/messages');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(StatusCodes.OK);
    expect(data.messages).toHaveLength(1);
    expect(data.pagination).toEqual({
      total: 50,
      remaining: 0,
      hasMore: false,
      nextCursor: null,
      limit: 20,
      sort: 'desc'
    });
  });

  it('should handle payloadToolkit filter', async () => {
    mockMessageModel.list.mockResolvedValue({
      messages: [],
      pagination: {
        total: 10,
        remaining: 0,
        hasMore: false,
        nextCursor: null,
        limit: 20,
        sort: 'desc'
      }
    });

    const request = new NextRequest('http://localhost:3000/api/v1/messages?payloadToolkit=test-toolkit');
    const response = await GET(request);
    await response.json();

    expect(response.status).toBe(StatusCodes.OK);
    expect(mockMessageModel.list).toHaveBeenCalledWith(
      { payloadToolkit: 'test-toolkit' },
      expect.any(Object)
    );
  });

  it('should handle database errors gracefully', async () => {
    const dbError = new Error('Database error');
    mockMessageModel.list.mockRejectedValue(dbError);

    const request = new NextRequest('http://localhost:3000/api/v1/messages');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(data.meta.message).toBe('Internal server error');
  });
}); 