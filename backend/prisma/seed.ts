import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL no está configurada');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const roles = [
  {
    name: 'Administrador',
    description: 'Gestiona todo el sistema de la biblioteca digital.',
    permissions: ['books.manage', 'users.manage', 'loans.manage'],
  },
  {
    name: 'Bibliotecario',
    description: 'Administra catálogo, préstamos y devoluciones.',
    permissions: ['books.read', 'books.manage', 'loans.manage'],
  },
  {
    name: 'Usuario',
    description: 'Rol base compatible para cuentas antiguas.',
    permissions: ['books.read', 'loans.create', 'loans.read'],
  },
  {
    name: 'Docente',
    description: 'Consulta libros y accede a préstamos con mayor plazo.',
    permissions: ['books.read', 'loans.create', 'loans.read'],
  },
  {
    name: 'Estudiante',
    description: 'Consulta libros, solicita préstamos y administra su historial.',
    permissions: ['books.read', 'loans.create', 'loans.read'],
  },
  {
    name: 'Invitado',
    description: 'Consulta información pública del catálogo.',
    permissions: ['books.read', 'authors.read', 'categories.read'],
  },
];

const permissions = [
  { name: 'books.read', description: 'Consultar libros del catálogo.' },
  { name: 'books.manage', description: 'Crear, editar y eliminar libros.' },
  { name: 'users.manage', description: 'Administrar usuarios.' },
  { name: 'loans.manage', description: 'Administrar préstamos.' },
  { name: 'loans.create', description: 'Solicitar préstamos.' },
  { name: 'loans.read', description: 'Consultar préstamos propios.' },
  { name: 'authors.read', description: 'Consultar autores.' },
  { name: 'categories.read', description: 'Consultar categorías.' },
];

async function main() {
  const permissionMap = new Map<string, number>();

  for (const permission of permissions) {
    const saved = await prisma.permission.upsert({
      where: { name: permission.name },
      update: { description: permission.description },
      create: permission,
    });
    permissionMap.set(saved.name, saved.id);
  }

  const roleMap = new Map<string, number>();

  for (const role of roles) {
    const saved = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description },
    });
    roleMap.set(saved.name, saved.id);

    for (const permissionName of role.permissions) {
      const permissionId = permissionMap.get(permissionName);
      if (!permissionId) continue;

      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: saved.id, permissionId } },
        update: {},
        create: { roleId: saved.id, permissionId },
      });
    }
  }

  const categories = [
    { name: 'Literatura', description: 'Novelas, cuentos y poesía.' },
    { name: 'Ciencia', description: 'Textos científicos y divulgativos.' },
    { name: 'Tecnología', description: 'Programación, datos e informática.' },
    { name: 'Historia', description: 'Historia universal y regional.' },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: { description: category.description },
      create: category,
    });
  }

  const authors = [
    { name: 'Gabriel García Márquez', biography: 'Autor colombiano.' },
    { name: 'Isaac Asimov', biography: 'Autor de ciencia ficción y divulgación.' },
    { name: 'Jane Austen', biography: 'Novelista británica.' },
    { name: 'Yuval Noah Harari', biography: 'Historiador y ensayista.' },
  ];

  for (const author of authors) {
    const existing = await prisma.author.findFirst({
      where: {
        OR: [
          { name: author.name },
          { name: author.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '') },
        ],
      },
    });

    if (existing) {
      await prisma.author.update({ where: { id: existing.id }, data: author });
    } else {
      await prisma.author.create({ data: author });
    }
  }

  const literature = await prisma.category.findUniqueOrThrow({ where: { name: 'Literatura' } });
  const science = await prisma.category.findUniqueOrThrow({ where: { name: 'Ciencia' } });
  const technology = await prisma.category.findUniqueOrThrow({ where: { name: 'Tecnología' } });
  const history = await prisma.category.findUniqueOrThrow({ where: { name: 'Historia' } });

  const garciaMarquez = await prisma.author.findFirstOrThrow({ where: { name: 'Gabriel García Márquez' } });
  const asimov = await prisma.author.findFirstOrThrow({ where: { name: 'Isaac Asimov' } });
  const austen = await prisma.author.findFirstOrThrow({ where: { name: 'Jane Austen' } });
  const harari = await prisma.author.findFirstOrThrow({ where: { name: 'Yuval Noah Harari' } });

  const books = [
    {
      title: 'Cien años de soledad',
      isbn: '9780307474728',
      description: 'Clásico de la literatura latinoamericana.',
      stock: 5,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780307474728-L.jpg',
      authorId: garciaMarquez.id,
      categoryId: literature.id,
    },
    {
      title: 'Fundación',
      isbn: '9780553293357',
      description: 'Saga esencial de ciencia ficción.',
      stock: 4,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780553293357-L.jpg',
      authorId: asimov.id,
      categoryId: science.id,
    },
    {
      title: 'Orgullo y prejuicio',
      isbn: '9780141439518',
      description: 'Novela clásica inglesa.',
      stock: 3,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780141439518-L.jpg',
      authorId: austen.id,
      categoryId: literature.id,
    },
    {
      title: 'Sapiens',
      isbn: '9780062316097',
      description: 'Breve historia de la humanidad.',
      stock: 6,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780062316097-L.jpg',
      authorId: harari.id,
      categoryId: history.id,
    },
    {
      title: 'Introducción a la programación',
      isbn: '9780000000002',
      description: 'Libro base para estudiantes de tecnología.',
      stock: 8,
      imageUrl: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=800&q=80',
      authorId: asimov.id,
      categoryId: technology.id,
    },
  ];

  for (const book of books) {
    const savedBook = await prisma.book.upsert({
      where: { isbn: book.isbn },
      update: book,
      create: book,
    });

    const copiesCount = await prisma.bookCopy.count({ where: { bookId: savedBook.id } });
    if (copiesCount === 0) {
      for (let index = 1; index <= Math.max(savedBook.stock, 1); index += 1) {
        await prisma.bookCopy.create({
          data: {
            bookId: savedBook.id,
            code: `LIB-${savedBook.id}-${String(index).padStart(3, '0')}`,
            status: savedBook.available ? 'DISPONIBLE' : 'MANTENIMIENTO',
          },
        });
      }
    }
  }

  const adminRoleId = roleMap.get('Administrador');
  const librarianRoleId = roleMap.get('Bibliotecario');
  const teacherRoleId = roleMap.get('Docente');
  const studentRoleId = roleMap.get('Estudiante') ?? roleMap.get('Usuario');

  if (adminRoleId) {
    await prisma.user.upsert({
      where: { email: 'sebassarmiento1029@gmail.com' },
      update: {
        name: 'Josten Sebastián Sarmiento',
        password: await bcrypt.hash('admin102938', 10),
        roleId: adminRoleId,
      },
      create: {
        name: 'Josten Sebastián Sarmiento',
        email: 'sebassarmiento1029@gmail.com',
        password: await bcrypt.hash('admin102938', 10),
        roleId: adminRoleId,
      },
    });
  }

  if (librarianRoleId) {
    await prisma.user.upsert({
      where: { email: 'jssarmiento@sudamericano.edu.ec' },
      update: {
        name: 'Bibliotecario/a Principal',
        password: await bcrypt.hash('biblio102938', 10),
        roleId: librarianRoleId,
      },
      create: {
        name: 'Bibliotecario/a Principal',
        email: 'jssarmiento@sudamericano.edu.ec',
        password: await bcrypt.hash('biblio102938', 10),
        roleId: librarianRoleId,
      },
    });
  }

  if (teacherRoleId) {
    await prisma.user.upsert({
      where: { email: 'docente@biblioteca.edu.ec' },
      update: {
        name: 'Docente Demo',
        password: await bcrypt.hash('docente102938', 10),
        roleId: teacherRoleId,
        status: 'ACTIVE',
      },
      create: {
        name: 'Docente Demo',
        email: 'docente@biblioteca.edu.ec',
        password: await bcrypt.hash('docente102938', 10),
        roleId: teacherRoleId,
        status: 'ACTIVE',
      },
    });
  }

  if (studentRoleId) {
    await prisma.user.upsert({
      where: { email: 'estudiante@biblioteca.edu.ec' },
      update: {
        name: 'Estudiante Demo',
        password: await bcrypt.hash('estudiante102938', 10),
        roleId: studentRoleId,
        status: 'ACTIVE',
      },
      create: {
        name: 'Estudiante Demo',
        email: 'estudiante@biblioteca.edu.ec',
        password: await bcrypt.hash('estudiante102938', 10),
        roleId: studentRoleId,
        status: 'ACTIVE',
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
