import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const roles = [
  {
    name: 'Administrador',
    description: 'Gestiona todo el sistema de la biblioteca digital.',
    permissions: ['books.manage', 'users.manage', 'loans.manage'],
  },
  {
    name: 'Bibliotecario',
    description: 'Administra catalogo, prestamos y devoluciones.',
    permissions: ['books.read', 'books.manage', 'loans.manage'],
  },
  {
    name: 'Usuario',
    description: 'Consulta libros y gestiona sus prestamos.',
    permissions: ['books.read', 'loans.create', 'loans.read'],
  },
  {
    name: 'Invitado',
    description: 'Consulta informacion publica del catalogo.',
    permissions: ['books.read', 'authors.read', 'categories.read'],
  },
];

const permissions = [
  { name: 'books.read', description: 'Consultar libros del catalogo.' },
  { name: 'books.manage', description: 'Crear, editar y eliminar libros.' },
  { name: 'users.manage', description: 'Administrar usuarios.' },
  { name: 'loans.manage', description: 'Administrar prestamos.' },
  { name: 'loans.create', description: 'Solicitar prestamos.' },
  { name: 'loans.read', description: 'Consultar prestamos propios.' },
  { name: 'authors.read', description: 'Consultar autores.' },
  { name: 'categories.read', description: 'Consultar categorias.' },
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
        where: {
          roleId_permissionId: {
            roleId: saved.id,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId: saved.id,
          permissionId,
        },
      });
    }
  }

  const categories = [
    { name: 'Literatura', description: 'Novelas, cuentos y poesia.' },
    { name: 'Ciencia', description: 'Textos cientificos y divulgativos.' },
    { name: 'Tecnologia', description: 'Programacion, datos e informatica.' },
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
    { name: 'Gabriel Garcia Marquez', biography: 'Autor colombiano.' },
    { name: 'Isaac Asimov', biography: 'Autor de ciencia ficcion y divulgacion.' },
    { name: 'Jane Austen', biography: 'Novelista britanica.' },
    { name: 'Yuval Noah Harari', biography: 'Historiador y ensayista.' },
  ];

  for (const author of authors) {
    const existing = await prisma.author.findFirst({ where: { name: author.name } });
    if (existing) {
      await prisma.author.update({ where: { id: existing.id }, data: author });
    } else {
      await prisma.author.create({ data: author });
    }
  }

  const literature = await prisma.category.findUniqueOrThrow({
    where: { name: 'Literatura' },
  });
  const science = await prisma.category.findUniqueOrThrow({
    where: { name: 'Ciencia' },
  });
  const technology = await prisma.category.findUniqueOrThrow({
    where: { name: 'Tecnologia' },
  });
  const history = await prisma.category.findUniqueOrThrow({
    where: { name: 'Historia' },
  });

  const garciaMarquez = await prisma.author.findFirstOrThrow({
    where: { name: 'Gabriel Garcia Marquez' },
  });
  const asimov = await prisma.author.findFirstOrThrow({
    where: { name: 'Isaac Asimov' },
  });
  const austen = await prisma.author.findFirstOrThrow({
    where: { name: 'Jane Austen' },
  });
  const harari = await prisma.author.findFirstOrThrow({
    where: { name: 'Yuval Noah Harari' },
  });

  const books = [
    {
      title: 'Cien anos de soledad',
      isbn: '9780307474728',
      description: 'Clasico de la literatura latinoamericana.',
      stock: 5,
      authorId: garciaMarquez.id,
      categoryId: literature.id,
    },
    {
      title: 'Fundacion',
      isbn: '9780553293357',
      description: 'Saga esencial de ciencia ficcion.',
      stock: 4,
      authorId: asimov.id,
      categoryId: science.id,
    },
    {
      title: 'Orgullo y prejuicio',
      isbn: '9780141439518',
      description: 'Novela clasica inglesa.',
      stock: 3,
      authorId: austen.id,
      categoryId: literature.id,
    },
    {
      title: 'Sapiens',
      isbn: '9780062316097',
      description: 'Breve historia de la humanidad.',
      stock: 6,
      authorId: harari.id,
      categoryId: history.id,
    },
    {
      title: 'Introduccion a la programacion',
      isbn: '9780000000002',
      description: 'Libro base para estudiantes de tecnologia.',
      stock: 8,
      authorId: asimov.id,
      categoryId: technology.id,
    },
  ];

  for (const book of books) {
    await prisma.book.upsert({
      where: { isbn: book.isbn },
      update: book,
      create: book,
    });
  }

  const adminRoleId = roleMap.get('Administrador');
  if (adminRoleId) {
    await prisma.user.upsert({
      where: { email: 'admin@biblioteca.local' },
      update: { name: 'Administrador Biblioteca', roleId: adminRoleId },
      create: {
        name: 'Administrador Biblioteca',
        email: 'admin@biblioteca.local',
        password: 'admin123',
        roleId: adminRoleId,
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
