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
    { name: 'Fantasía', description: 'Mundos imaginarios, aventuras épicas y magia.' },
    { name: 'Distopía', description: 'Futuros críticos y sociedades opresivas.' },
    { name: 'Misterio', description: 'Intriga, investigación y suspenso.' },
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
    { name: 'George Orwell', biography: 'Novelista y ensayista británico.' },
    { name: 'Harper Lee', biography: 'Novelista estadounidense.' },
    { name: 'F. Scott Fitzgerald', biography: 'Autor estadounidense de la generación perdida.' },
    { name: 'J.R.R. Tolkien', biography: 'Escritor y filólogo británico.' },
    { name: 'Miguel de Cervantes', biography: 'Escritor español del Siglo de Oro.' },
    { name: 'Mary Shelley', biography: 'Novelista británica precursora de la ciencia ficción.' },
    { name: 'Agatha Christie', biography: 'Autora británica de misterio.' },
    { name: 'Ray Bradbury', biography: 'Escritor estadounidense de ciencia ficción.' },
    { name: 'Aldous Huxley', biography: 'Escritor británico de ficción especulativa.' },
    { name: 'J.D. Salinger', biography: 'Novelista estadounidense.' },
    { name: 'Paulo Coelho', biography: 'Escritor brasileño.' },
    { name: 'Antoine de Saint-Exupéry', biography: 'Escritor y aviador francés.' },
    { name: 'Herman Melville', biography: 'Novelista estadounidense.' },
    { name: 'Bram Stoker', biography: 'Novelista irlandés.' },
    { name: 'Victor Hugo', biography: 'Novelista y poeta francés.' },
    { name: 'Leo Tolstoy', biography: 'Novelista ruso.' },
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
  const fantasy = await prisma.category.findUniqueOrThrow({ where: { name: 'Fantasía' } });
  const dystopia = await prisma.category.findUniqueOrThrow({ where: { name: 'Distopía' } });
  const mystery = await prisma.category.findUniqueOrThrow({ where: { name: 'Misterio' } });

  const garciaMarquez = await prisma.author.findFirstOrThrow({ where: { name: 'Gabriel García Márquez' } });
  const asimov = await prisma.author.findFirstOrThrow({ where: { name: 'Isaac Asimov' } });
  const austen = await prisma.author.findFirstOrThrow({ where: { name: 'Jane Austen' } });
  const harari = await prisma.author.findFirstOrThrow({ where: { name: 'Yuval Noah Harari' } });
  const orwell = await prisma.author.findFirstOrThrow({ where: { name: 'George Orwell' } });
  const harperLee = await prisma.author.findFirstOrThrow({ where: { name: 'Harper Lee' } });
  const fitzgerald = await prisma.author.findFirstOrThrow({ where: { name: 'F. Scott Fitzgerald' } });
  const tolkien = await prisma.author.findFirstOrThrow({ where: { name: 'J.R.R. Tolkien' } });
  const cervantes = await prisma.author.findFirstOrThrow({ where: { name: 'Miguel de Cervantes' } });
  const shelley = await prisma.author.findFirstOrThrow({ where: { name: 'Mary Shelley' } });
  const christie = await prisma.author.findFirstOrThrow({ where: { name: 'Agatha Christie' } });
  const bradbury = await prisma.author.findFirstOrThrow({ where: { name: 'Ray Bradbury' } });
  const huxley = await prisma.author.findFirstOrThrow({ where: { name: 'Aldous Huxley' } });
  const salinger = await prisma.author.findFirstOrThrow({ where: { name: 'J.D. Salinger' } });
  const coelho = await prisma.author.findFirstOrThrow({ where: { name: 'Paulo Coelho' } });
  const saintExupery = await prisma.author.findFirstOrThrow({ where: { name: 'Antoine de Saint-Exupéry' } });
  const melville = await prisma.author.findFirstOrThrow({ where: { name: 'Herman Melville' } });
  const stoker = await prisma.author.findFirstOrThrow({ where: { name: 'Bram Stoker' } });
  const hugo = await prisma.author.findFirstOrThrow({ where: { name: 'Victor Hugo' } });
  const tolstoy = await prisma.author.findFirstOrThrow({ where: { name: 'Leo Tolstoy' } });

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
    {
      title: '1984',
      isbn: '9780451524935',
      description: 'Una distopía sobre vigilancia, propaganda y control político.',
      stock: 6,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg',
      authorId: orwell.id,
      categoryId: dystopia.id,
    },
    {
      title: 'Rebelión en la granja',
      isbn: '9780451526342',
      description: 'Fábula política sobre poder, corrupción y revolución.',
      stock: 5,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780451526342-L.jpg',
      authorId: orwell.id,
      categoryId: dystopia.id,
    },
    {
      title: 'Matar a un ruiseñor',
      isbn: '9780061120084',
      description: 'Novela sobre justicia, prejuicio y crecimiento moral en el sur estadounidense.',
      stock: 4,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780061120084-L.jpg',
      authorId: harperLee.id,
      categoryId: literature.id,
    },
    {
      title: 'El gran Gatsby',
      isbn: '9780743273565',
      description: 'Retrato elegante y amargo del sueño americano en los años veinte.',
      stock: 4,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg',
      authorId: fitzgerald.id,
      categoryId: literature.id,
    },
    {
      title: 'El Hobbit',
      isbn: '9780547928227',
      description: 'Aventura fantástica de Bilbo Bolsón hacia la Montaña Solitaria.',
      stock: 7,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg',
      authorId: tolkien.id,
      categoryId: fantasy.id,
    },
    {
      title: 'El señor de los anillos',
      isbn: '9780618640157',
      description: 'Épica fantástica sobre amistad, sacrificio y la lucha contra la oscuridad.',
      stock: 5,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780618640157-L.jpg',
      authorId: tolkien.id,
      categoryId: fantasy.id,
    },
    {
      title: 'Don Quijote de la Mancha',
      isbn: '9788424119893',
      description: 'Clásico universal sobre idealismo, locura, humor y aventura.',
      stock: 5,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9788424119893-L.jpg',
      authorId: cervantes.id,
      categoryId: literature.id,
    },
    {
      title: 'Frankenstein',
      isbn: '9780486282114',
      description: 'Relato gótico sobre creación, responsabilidad y soledad.',
      stock: 4,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780486282114-L.jpg',
      authorId: shelley.id,
      categoryId: science.id,
    },
    {
      title: 'Asesinato en el Orient Express',
      isbn: '9780062073501',
      description: 'Misterio clásico de Hércules Poirot a bordo de un tren detenido por la nieve.',
      stock: 4,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780062073501-L.jpg',
      authorId: christie.id,
      categoryId: mystery.id,
    },
    {
      title: 'Diez negritos',
      isbn: '9780062073488',
      description: 'Diez desconocidos son reunidos en una isla donde cada secreto puede ser mortal.',
      stock: 4,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780062073488-L.jpg',
      authorId: christie.id,
      categoryId: mystery.id,
    },
    {
      title: 'Fahrenheit 451',
      isbn: '9781451673319',
      description: 'Distopía sobre censura, memoria y el valor de los libros.',
      stock: 5,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9781451673319-L.jpg',
      authorId: bradbury.id,
      categoryId: dystopia.id,
    },
    {
      title: 'Un mundo feliz',
      isbn: '9780060850524',
      description: 'Sociedad futurista donde la felicidad artificial oculta pérdida de libertad.',
      stock: 5,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780060850524-L.jpg',
      authorId: huxley.id,
      categoryId: dystopia.id,
    },
    {
      title: 'El guardián entre el centeno',
      isbn: '9780316769488',
      description: 'Viaje íntimo de Holden Caulfield entre rebeldía, confusión y adolescencia.',
      stock: 4,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780316769488-L.jpg',
      authorId: salinger.id,
      categoryId: literature.id,
    },
    {
      title: 'El alquimista',
      isbn: '9780061122415',
      description: 'Fábula espiritual sobre sueños, destino y búsqueda personal.',
      stock: 6,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780061122415-L.jpg',
      authorId: coelho.id,
      categoryId: literature.id,
    },
    {
      title: 'El principito',
      isbn: '9780156012195',
      description: 'Historia poética sobre amistad, inocencia y lo esencial de la vida.',
      stock: 8,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780156012195-L.jpg',
      authorId: saintExupery.id,
      categoryId: literature.id,
    },
    {
      title: 'Moby Dick',
      isbn: '9781503280786',
      description: 'Aventura marítima y obsesión del capitán Ahab por la ballena blanca.',
      stock: 3,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9781503280786-L.jpg',
      authorId: melville.id,
      categoryId: literature.id,
    },
    {
      title: 'Drácula',
      isbn: '9780486411095',
      description: 'Novela gótica que consolidó el mito moderno del vampiro.',
      stock: 4,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780486411095-L.jpg',
      authorId: stoker.id,
      categoryId: mystery.id,
    },
    {
      title: 'Los miserables',
      isbn: '9780451419439',
      description: 'Monumental novela sobre redención, injusticia y esperanza social.',
      stock: 4,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780451419439-L.jpg',
      authorId: hugo.id,
      categoryId: literature.id,
    },
    {
      title: 'Anna Karenina',
      isbn: '9780143035008',
      description: 'Drama ruso sobre amor, familia, deseo y presión social.',
      stock: 4,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780143035008-L.jpg',
      authorId: tolstoy.id,
      categoryId: literature.id,
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
