export type Catalog = { id: string; name: string };
export type Book = {
  id: string;
  title: string;
  author: Catalog;
  publisher: Catalog;
  genre: Catalog;
  price: string;
  isAvailable: boolean;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};
export type BookValues = {
  title: string;
  author: string;
  publisher: string;
  genre: string;
  price: string;
  isAvailable: boolean;
};
export type PageMeta = { page: number; pageSize: number; total: number; totalPages: number };
export type Envelope<T> = { data: T; meta: PageMeta };
export type LoginResult = {
  accessToken: string;
  user: { id: string; email: string; role: string };
};
