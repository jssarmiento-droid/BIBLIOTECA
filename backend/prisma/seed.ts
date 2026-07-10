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
      description: 'Cien años de soledad, escrita por Gabriel García Márquez y publicada en 1967, narra la historia de siete generaciones de la familia Buendía en el pueblo ficticio de Macondo. La novela relata el ascenso y la caída de este linaje, marcado por el incesto, la fatalidad, las guerras y una profunda soledad generacional, todo entrelazado con elementos de realismo mágico.',
      stock: 5,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780307474728-L.jpg',
      authorId: garciaMarquez.id,
      categoryId: literature.id,
    },
    {
      title: 'Fundación',
      isbn: '9780553293357',
      description: 'En un Imperio Galáctico en decadencia, el matemático Hari Seldon utiliza la "psicohistoria" (matemáticas aplicadas a la sociología) para predecir su inminente colapso y 30.000 años de barbarie. Para reducir este caos a solo un milenio, Seldon exilia a las mejores mentes al planeta Términus para crear la Fundación.',
      stock: 4,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780553293357-L.jpg',
      authorId: asimov.id,
      categoryId: science.id,
    },
    {
      title: 'Orgullo y prejuicio',
      isbn: '9780141439518',
      description: 'Orgullo y Prejuicio, escrita por Jane Austen, es una comedia romántica clásica de la Inglaterra del siglo XIX. Narra la historia de Elizabeth Bennet, una joven independiente, y el adinerado señor Darcy, quienes deben superar sus propios defectos: el orgullo de clase de él y los prejuicios precipitados de ella, para descubrir su verdadero amor.',
      stock: 3,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780141439518-L.jpg',
      authorId: austen.id,
      categoryId: literature.id,
    },
    {
      title: 'Sapiens',
      isbn: '9780062316097',
      description: 'Sapiens: De animales a dioses de Yuval Noah Harari explora la evolución de la humanidad a través de cuatro revoluciones: Cognitiva, Agrícola, Científica y la unificación del mundo. Argumenta que el dominio del Homo sapiens se debe a su capacidad única para crear y creer en ficciones compartidas —como el dinero, las religiones, las leyes y los imperios—, lo que permite la cooperación masiva entre desconocidos.',
      stock: 6,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780062316097-L.jpg',
      authorId: harari.id,
      categoryId: history.id,
    },
    {
      title: 'Introducción a la programación',
      isbn: '9780000000002',
      description: 'El texto funciona como una guía no técnica y libre de matemáticas complejas orientada a que cualquier principiante aprenda a "pensar como programador". En lugar de enseñar las reglas rígidas de sintaxis de un lenguaje como Java, C++ o Python, el libro utiliza pseudocódigo en español y diagramas de flujo como herramientas universales para diseñar algoritmos efectivos.',
      stock: 8,
      imageUrl: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=800&q=80',
      authorId: asimov.id,
      categoryId: technology.id,
    },
    {
      title: '1984',
      isbn: '9780451524935',
      description: '1984, escrita por George Orwell y publicada en 1949, es una novela clásica de ciencia ficción distópica. La historia advierte sobre los peligros de los regímenes totalitarios, explorando cómo un gobierno puede anular por completo la libertad individual, la privacidad, la historia e incluso el pensamiento crítico.',
      stock: 6,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg',
      authorId: orwell.id,
      categoryId: dystopia.id,
    },
    {
      title: 'Rebelión en la granja',
      isbn: '9780451526342',
      description: 'Rebelión en la granja es una novela satírica de George Orwell que narra cómo los animales de una granja se rebelan contra su dueño humano para crear una sociedad igualitaria. Sin embargo, la corrupción y el ansia de poder de los cerdos líderes transforman la utopía en una dictadura totalitaria.',
      stock: 5,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780451526342-L.jpg',
      authorId: orwell.id,
      categoryId: dystopia.id,
    },
    {
      title: 'Matar a un ruiseñor',
      isbn: '9780061120084',
      description: 'Matar a un ruiseñor de Harper Lee (publicada en 1960) narra la historia de Scout Finch, una niña que crece en un pueblo de Alabama durante la Gran Depresión. Su padre, el abogado Atticus Finch, defiende a un hombre negro acusado injustamente de violación, mientras Scout y suhermano Jem descubren el valor y enfrentan los prejuicios raciales de su comunidad.',
      stock: 4,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780061120084-L.jpg',
      authorId: harperLee.id,
      categoryId: literature.id,
    },
    {
      title: 'El gran Gatsby',
      isbn: '9780743273565',
      description: '"El gran Gatsby", a través de los ojos del narrador, Nick Carraway, retrata aquella alocada década de los años veinte, marcada por la ley seca, el jazz y las grandes fiestas que afloraban sobre un mundo de negocios poco lícitos, corrupciones y sueños inalcanzables.',
      stock: 4,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg',
      authorId: fitzgerald.id,
      categoryId: literature.id,
    },
    {
      title: 'El Hobbit',
      isbn: '9780547928227',
      description: 'Dentro de dicha ficción, el argumento de El hobbit se sitúa en el año 2941 de la Tercera Edad del Sol, y narra la historia del hobbit Bilbo Bolsón, que junto con el mago Gandalf y un grupo de enanos, vive una aventura en busca del tesoro custodiado por el dragón Smaug en la lejana Montaña Solitaria.',
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
      description: 'Escrita por Miguel de Cervantes, la obra narra las aventuras de Alonso Quijano, un hidalgo que enloquece por leer obsesivamente libros de caballerías. Convencido de ser un caballero andante, adopta el nombre de Don Quijote de la Mancha y recorre España junto a su fiel escudero, Sancho Panza, buscando hacer justicia y defender a los más necesitados.',
      stock: 5,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9788424119893-L.jpg',
      authorId: cervantes.id,
      categoryId: literature.id,
    },
    {
      title: 'Frankenstein',
      isbn: '9780486282114',
      description: 'Victor Frankenstein, un joven y brillante científico suizo, descubre el secreto para dar vida a la materia inanimada y crea un ser de aspecto grotesco. Horrorizado por su creación, lo abandona. Rechazada por la sociedad y consumida por la soledad, la criatura busca venganza asesinando a los seres queridos de Víctor.',
      stock: 4,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780486282114-L.jpg',
      authorId: shelley.id,
      categoryId: science.id,
    },
    {
      title: 'Asesinato en el Orient Express',
      isbn: '9780062073501',
      description: 'Ratchett fue asesinado colectivamente por doce de los pasajeros del Orient Express. El detective Hércules Poirot descubrió que todos ellos estaban vinculados a la familia Armstrong y decidieron vengar el secuestro y asesinato de la pequeña Daisy Armstrong. Cada uno de los cómplices le asestó una puñalada diferente mientras dormía.',
      stock: 4,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780062073501-L.jpg',
      authorId: christie.id,
      categoryId: mystery.id,
    },
    {
      title: 'Diez negritos',
      isbn: '9780062073488',
      description: 'Diez personas llegan a la Isla del Negro (Inglaterra), invitadas por un misterioso anfitrión llamado U.N. Owen. Tras la primera cena, una grabación de voz acusa a cada uno de los invitados de haber cometido un crimen en el pasado por el que la justicia no los ha castigado. Rápidamente, los invitados quedan atrapados por una tormenta y comienzan a morir uno a uno, exactamente de la misma manera en que lo describen los versos de la canción de los "diez negritos" que cuelga en sus habitaciones.',
      stock: 4,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780062073488-L.jpg',
      authorId: christie.id,
      categoryId: mystery.id,
    },
    {
      title: 'Fahrenheit 451',
      isbn: '9781451673319',
      description: 'Los temas principales en Fahrenheit 451 incluyen conocimiento vs. ignorancia y censura. La novela explora cómo suprimir libros conduce a la ignorancia social, mientras que el acceso al conocimiento empodera a las personas para pensar críticamente.',
      stock: 5,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9781451673319-L.jpg',
      authorId: bradbury.id,
      categoryId: dystopia.id,
    },
    {
      title: 'Un mundo feliz',
      isbn: '9780060850524',
      description: 'La novela es una distopía que anticipa el desarrollo en tecnología reproductiva, cultivos humanos, hipnopedia y manejo de las emociones por medio de drogas (soma) que, combinadas, cambian radicalmente la sociedad.',
      stock: 5,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780060850524-L.jpg',
      authorId: huxley.id,
      categoryId: dystopia.id,
    },
    {
      title: 'El guardián entre el centeno',
      isbn: '9780316769488',
      description: 'El guardián entre el centeno, escrita por J.D. Salinger y publicada en 1951, es una novela clásica que narra la historia de Holden Caulfield, un adolescente de 16 años expulsado de su internado. Tras ser expulsado, Holden deambula por la ciudad de Nueva York durante unos días mientras lidia con la alienación, la depresión y su incapacidad para aceptar la falsedad del mundo adulto.',
      stock: 4,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780316769488-L.jpg',
      authorId: salinger.id,
      categoryId: literature.id,
    },
    {
      title: 'El alquimista',
      isbn: '9780061122415',
      description: 'El Alquimista de Paulo Coelho narra la historia de Santiago, un pastor andaluz que deja su rebaño para perseguir su "Leyenda Personal": un tesoro escondido cerca de las pirámides de Egipto. A través de un viaje iniciático por el desierto, aprende a escuchar a su corazón y a comprender el Alma del Mundo.',
      stock: 6,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780061122415-L.jpg',
      authorId: coelho.id,
      categoryId: literature.id,
    },
    {
      title: 'El principito',
      isbn: '9780156012195',
      description: 'El Principito, escrito por Antoine de Saint-Exupéry, es una novela corta que narra la historia de un piloto cuyo avión se avería en el desierto del Sahara. Allí conoce a un misterioso niño proveniente de otro asteroide, quien le enseña profundas lecciones sobre el amor, la amistad y la verdadera esencia de la vida.',
      stock: 8,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780156012195-L.jpg',
      authorId: saintExupery.id,
      categoryId: literature.id,
    },
    {
      title: 'Moby Dick',
      isbn: '9781503280786',
      description: 'Moby Dick narra la historia de la tripulación del barco ballenero Pequod y su capitán, Ahab. El capitán está consumido por una obsesión: vengarse de Moby Dick, un enorme cachalote blanco que en un viaje anterior le arrancó la pierna. La historia es narrada por el joven marinero Ismael.',
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
      description: 'La trama principal sigue a Jean Valjean, un exconvicto que pasó 19 años en prisión por robar una hogaza de pan. Tras ser ayudado por un bondadoso obispo, Valjean decide romper con su pasado y cambiar su vida. Sin embargo, el implacable inspector de policía Javert se obsesiona con perseguirlo, representando la justicia inflexible.',
      stock: 4,
      imageUrl: 'https://covers.openlibrary.org/b/isbn/9780451419439-L.jpg',
      authorId: hugo.id,
      categoryId: literature.id,
    },
    {
      title: 'Anna Karenina',
      isbn: '9780143035008',
      description: 'Ana Karenina, escrita por León Tolstói y publicada en 1877, es una de las obras cumbres del realismo. La novela narra la trágica historia de una aristócrata rusa que desafía las convenciones sociales al abandonar a su esposo y a su hijo por un joven militar, enfrentando el rechazo y la condena de la alta sociedad.',
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
        name: 'Docente',
        password: await bcrypt.hash('docente102938', 10),
        roleId: teacherRoleId,
        status: 'ACTIVE',
      },
      create: {
        name: 'Docente',
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
        name: 'Estudiante',
        password: await bcrypt.hash('estudiante102938', 10),
        roleId: studentRoleId,
        status: 'ACTIVE',
      },
      create: {
        name: 'Estudiante',
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
