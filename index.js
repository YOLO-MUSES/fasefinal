const express = require('express');
const { create } = require('express-handlebars');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const User = require('./models/users');
const cors = require('cors');
const mongosanitize = require('express-mongo-sanitize');
require('dotenv').config();

const { main } = require('./database/db');
const mongoStore = require('connect-mongo');
const app = express();

// CORS configuración (descomenta si lo necesitas)
app.use(cors({
    credentials: true,
    origin: process.env.PATHHEROKU || '*',
    methods: ['GET', 'POST']
}));

app.set("trust proxy", 1); // Si estás detrás de un proxy (Heroku o Nginx), habilita esta opción.

// Configuración de la sesión
app.use(session({
    secret: process.env.SECRET_SESION || "52D5FA11-9E49-49D4-A0FD-394E0D0FE98E", // Cargar desde .env
    resave: false,
    saveUninitialized: false,
    name: "secret-name-yolo", // Nombre personalizado para la cookie de la sesión
    store: mongoStore.create({
        clientPromise: main,  // Promesa de conexión a MongoDB
        dbName: process.env.BD_NAME  // Nombre de la base de datos
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Solo en HTTPS en producción
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 días de duración
    }
}));

app.use(flash()); // Middleware para mensajes flash



// Inicialización de Passport
app.use(passport.initialize());
app.use(passport.session());

// Serializar y deserializar usuario
passport.serializeUser((user, done) => done(null, { id: user._id, userName: user.userName }));
passport.deserializeUser(async (user, done) => {
    try {
        const userdb = await User.findById(user.id);
        return done(null, { id: userdb._id, username: userdb.userName });
    } catch (err) {
        return done(err);
    }
});

// Configuración de Handlebars
const hbs = create({
    extname: 'hbs',
    layoutsDir: 'Views/Layouts', // Esta debe ser una cadena
    partialsDir: 'Views/Components', // También debe ser una cadena
    defaultLayout: 'main' // Nombre del archivo de layout sin la extensión
});
app.engine('hbs', hbs.engine);
hbs.handlebars.registerHelper('allowProtoPropertiesByDefault', true);
hbs.handlebars.registerHelper('allowProtoMethodsByDefault', true);
app.set('view engine', 'hbs');
app.set('views', './Views');

// Middleware para leer datos del formulario
app.use(express.urlencoded({ extended: false }));

// Middleware para manejar JSON
app.use(express.json());
app.use(mongosanitize()); // Evitar inyecciones en MongoDB

// Rutas principales
app.use('/auth', require('./Routes/auth'));
app.use('/', require('./Routes/homeRoutes'));


// Archivos estáticos
app.use(express.static(__dirname + '/public'));

// Levantar el servidor
const PORT = process.env.PORT || 3000; // Puerto
app.listen(PORT, () => {
    console.log(`Escuchando en el puerto http://localhost:${PORT}`);
});
