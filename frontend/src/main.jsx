import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import api from './api';
import './styles.css';

const emptyBook = {
  title: '',
  isbn: '',
  description: '',
  stock: 1,
  available: true,
  authorId: '',
  categoryId: '',
};

function App() {
  const [activeView, setActiveView] = useState('inicio');
  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyBook);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const stats = useMemo(
    () => [
      { label: 'Libros', value: books.length },
      { label: 'Usuarios', value: users.length },
      { label: 'Prestamos', value: loans.length },
      { label: 'Roles', value: roles.length },
    ],
    [books.length, loans.length, roles.length, users.length],
  );

  async function loadData() {
    setLoading(true);
    setMessage('');

    try {
      const [
        booksRes,
        usersRes,
        loansRes,
        rolesRes,
        permissionsRes,
        authorsRes,
        categoriesRes,
      ] =
        await Promise.all([
          api.get('/books'),
          api.get('/users'),
          api.get('/loans'),
          api.get('/roles'),
          api.get('/permissions'),
          api.get('/books/authors/list'),
          api.get('/books/categories/list'),
        ]);

      setBooks(booksRes.data);
      setUsers(usersRes.data);
      setLoans(loansRes.data);
      setRoles(rolesRes.data);
      setPermissions(permissionsRes.data);
      setAuthors(authorsRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      setMessage('No se pudo conectar con el backend. Revisa VITE_API_URL.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateForm(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function createBook(event) {
    event.preventDefault();
    setMessage('');

    try {
      await api.post('/books', {
        ...form,
        stock: Number(form.stock),
        authorId: Number(form.authorId),
        categoryId: Number(form.categoryId),
      });
      setForm(emptyBook);
      setMessage('Libro agregado correctamente.');
      await loadData();
      setActiveView('catalogo');
    } catch (error) {
      setMessage('No se pudo agregar el libro. Verifica autorId y categoryId.');
    }
  }

  const navItems = [
    ['inicio', 'Inicio'],
    ['catalogo', 'Catalogo'],
    ['nuevo', 'Agregar libro'],
    ['usuarios', 'Usuarios'],
    ['prestamos', 'Prestamos'],
    ['roles', 'Roles y permisos'],
  ];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Sistema academico</p>
          <h1>Biblioteca Digital</h1>
        </div>

        <nav>
          {navItems.map(([key, label]) => (
            <button
              className={activeView === key ? 'active' : ''}
              key={key}
              onClick={() => setActiveView(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>

        <button className="refresh" onClick={loadData} type="button">
          Actualizar datos
        </button>
      </aside>

      <section className="content">
        {message && <div className="notice">{message}</div>}
        {loading && <div className="notice muted">Cargando informacion...</div>}

        {activeView === 'inicio' && (
          <section className="hero">
            <div>
              <p className="eyebrow">Gestion bibliotecaria</p>
              <h2>Catalogo, usuarios, prestamos y permisos en un solo panel.</h2>
              <p>
                Una interfaz sobria para administrar una biblioteca digital con
                backend NestJS, Prisma y PostgreSQL.
              </p>
            </div>
            <div className="stats-grid">
              {stats.map((item) => (
                <article className="stat-card" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeView === 'catalogo' && (
          <section>
            <Header title="Catalogo de libros" count={books.length} />
            <div className="book-grid">
              {books.map((book) => (
                <article className="book-card" key={book.id}>
                  <span>{book.category?.name || 'Sin categoria'}</span>
                  <h3>{book.title}</h3>
                  <p>{book.description || 'Sin descripcion registrada.'}</p>
                  <dl>
                    <div>
                      <dt>Autor</dt>
                      <dd>{book.author?.name || 'No asignado'}</dd>
                    </div>
                    <div>
                      <dt>ISBN</dt>
                      <dd>{book.isbn}</dd>
                    </div>
                    <div>
                      <dt>Stock</dt>
                      <dd>{book.stock}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeView === 'nuevo' && (
          <section>
            <Header title="Agregar libro" />
            <form className="form-panel" onSubmit={createBook}>
              <input name="title" onChange={updateForm} placeholder="Titulo" required value={form.title} />
              <input name="isbn" onChange={updateForm} placeholder="ISBN" required value={form.isbn} />
              <textarea name="description" onChange={updateForm} placeholder="Descripcion" value={form.description} />
              <input min="0" name="stock" onChange={updateForm} placeholder="Stock" type="number" value={form.stock} />
              <select name="authorId" onChange={updateForm} required value={form.authorId}>
                <option value="">Selecciona un autor</option>
                {authors.map((author) => (
                  <option key={author.id} value={author.id}>
                    {author.name}
                  </option>
                ))}
              </select>
              <select name="categoryId" onChange={updateForm} required value={form.categoryId}>
                <option value="">Selecciona una categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <label className="check-row">
                <input checked={form.available} name="available" onChange={updateForm} type="checkbox" />
                Disponible
              </label>
              <button type="submit">Guardar libro</button>
            </form>
          </section>
        )}

        {activeView === 'usuarios' && (
          <Table
            columns={['Nombre', 'Email', 'Rol']}
            rows={users.map((user) => [
              user.name,
              user.email,
              user.role?.name || 'Sin rol',
            ])}
            title="Usuarios"
          />
        )}

        {activeView === 'prestamos' && (
          <Table
            columns={['Usuario', 'Libro', 'Estado', 'Fecha']}
            rows={loans.map((loan) => [
              loan.user?.name || `Usuario ${loan.userId}`,
              loan.book?.title || `Libro ${loan.bookId}`,
              loan.status,
              new Date(loan.loanDate).toLocaleDateString(),
            ])}
            title="Prestamos"
          />
        )}

        {activeView === 'roles' && (
          <section>
            <Header title="Roles y permisos" count={roles.length} />
            <div className="roles-layout">
              {roles.map((role) => (
                <article className="role-card" key={role.id}>
                  <h3>{role.name}</h3>
                  <p>{role.description || 'Sin descripcion.'}</p>
                  <div className="chips">
                    {(role.permissions || []).map((item) => (
                      <span key={item.id}>{item.permission?.name}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <Header title="Permisos registrados" count={permissions.length} />
            <div className="chips wide">
              {permissions.map((permission) => (
                <span key={permission.id}>{permission.name}</span>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function Header({ title, count }) {
  return (
    <header className="section-header">
      <h2>{title}</h2>
      {count !== undefined && <span>{count} registros</span>}
    </header>
  );
}

function Table({ columns, rows, title }) {
  return (
    <section>
      <Header title={title} count={rows.length} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

createRoot(document.getElementById('root')).render(<App />);
