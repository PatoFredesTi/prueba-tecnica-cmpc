import { api, ApiError, setSession, validateImage, uploadImage, exportBooks } from './api';
afterEach(() => {
  setSession(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe('Cliente HTTP', () => {
  it('envía token en memoria y cuerpo JSON', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 1 } })));
    vi.stubGlobal('fetch', fetcher);
    setSession('jwt');
    expect(await api('/books', { method: 'POST', body: '{}' })).toEqual({ data: { id: 1 } });
    const headers = fetcher.mock.calls[0][1].headers;
    expect(headers.get('Authorization')).toBe('Bearer jwt');
    expect(headers.get('Content-Type')).toBe('application/json');
  });
  it('propaga mensaje, status y correlación de errores', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Datos inválidos', requestId: 'req' }), {
          status: 400,
        }),
      ),
    );
    await expect(api('/books')).rejects.toMatchObject({
      message: 'Datos inválidos',
      status: 400,
      requestId: 'req',
    });
  });
  it('cierra sesión con 401 excepto en login', async () => {
    const expire = vi.fn();
    setSession('token', expire);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(new Response('{}', { status: 401 }))),
    );
    await expect(api('/auth/login')).rejects.toBeInstanceOf(ApiError);
    expect(expire).not.toHaveBeenCalled();
    await expect(api('/books')).rejects.toBeInstanceOf(ApiError);
    expect(expire).toHaveBeenCalledTimes(1);
  });
  it('informa caída de red y error sin JSON', async () => {
    const mock = vi
      .fn()
      .mockRejectedValueOnce(new Error())
      .mockResolvedValueOnce(new Response('bad', { status: 500 }));
    vi.stubGlobal('fetch', mock);
    await expect(api('/books')).rejects.toMatchObject({ status: 0 });
    await expect(api('/books')).rejects.toThrow('No fue posible');
  });
  it('sube multipart sin forzar Content-Type', async () => {
    const mock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', mock);
    const file = new File(['image'], 'cover.png', { type: 'image/png' });
    await uploadImage('id', file);
    expect(mock.mock.calls[0][1].body.get('file')).toBe(file);
    expect(mock.mock.calls[0][1].headers.has('Content-Type')).toBe(false);
  });
  it('descarga CSV y libera URL temporal', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('title\r\nbook')));
    const create = vi.fn().mockReturnValue('blob:test'),
      revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: create, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revoke, configurable: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await exportBooks(new URLSearchParams({ search: 'libro' }));
    expect(click).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });
  it('valida MIME y tamaño antes de subir', () => {
    expect(validateImage(new File(['ok'], 'a.png', { type: 'image/png' }))).toBeUndefined();
    expect(validateImage(new File(['x'], 'a.txt', { type: 'text/plain' }))).toContain('JPEG');
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 });
    expect(validateImage(file)).toContain('5 MB');
  });
});
