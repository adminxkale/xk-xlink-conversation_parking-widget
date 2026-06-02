import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchGroupPhones, fetchChannels } from './lines.adapter';

describe('lines.adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchGroupPhones', () => {
    it('returns parsed lines from Xlink API response format', async () => {
      const mockXlinkResponse = [
        {
          group_id: 'group-1',
          phone_numbers: {
            'Line A': '+1234567890',
            'Line B': '+0987654321',
          },
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockXlinkResponse),
      });

      const result = await fetchGroupPhones('group-1');

      expect(result).toEqual([
        { id: '+1234567890', number: 'Line A', phone_number_id: '+1234567890', phone_number: '+1234567890', groups: ['group-1'] },
        { id: '+0987654321', number: 'Line B', phone_number_id: '+0987654321', phone_number: '+0987654321', groups: ['group-1'] },
      ]);
      expect(fetch).toHaveBeenCalledWith('/api/proxy-group-phones?group_id=group-1');
    });

    it('returns empty array for non-array response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ not: 'an array' }),
      });

      const result = await fetchGroupPhones('group-2');

      expect(result).toEqual([]);
    });

    it('throws on non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

      await expect(fetchGroupPhones('group-x')).rejects.toThrow(
        'Failed to fetch group phones for group group-x: 500'
      );
    });

    it('encodes groupId in URL', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await fetchGroupPhones('group with spaces');

      expect(fetch).toHaveBeenCalledWith(
        '/api/proxy-group-phones?group_id=group%20with%20spaces'
      );
    });
  });

  describe('fetchChannels', () => {
    it('returns mapped lines from API response array', async () => {
      const mockChannels = [
        { id: 'ch-1', phone_number_id: 'cpn-1', phone_number: '+555', name: 'Channel 1' },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockChannels),
      });

      const result = await fetchChannels();

      expect(result).toEqual([
        { id: 'ch-1', number: 'Channel 1', phone_number_id: 'cpn-1', phone_number: '+555' },
      ]);
      expect(fetch).toHaveBeenCalledWith('/api/proxy-channels');
    });

    it('handles response with channels wrapper object', async () => {
      const mockData = {
        channels: [
          { phone_number_id: 'cpn-2', phone_number: '+666', name: 'Fallback' },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await fetchChannels();

      expect(result).toHaveLength(1);
      expect(result[0].phone_number).toBe('+666');
      expect(result[0]).not.toHaveProperty('groups');
    });

    it('throws on non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });

      await expect(fetchChannels()).rejects.toThrow(
        'Failed to fetch channels: 503'
      );
    });
  });
});
