const PDFDocument = require('pdfkit');
const Publics = require('../models/Postings');
const users = require('../models/users');
const fs = require('fs');
const mongoose = require('mongoose');
const Comment = require('../models/commentSchema')
const Venta = require('../models/VentaModel');
const path = require('path');
const cargaBusqueda = async (req, res) => {
    try {
        const usuarios = await users.find().lean(); // Obtenemos todos los usuarios

        // Enviamos el array completo de usuarios a la vista
        res.render('buscarPerfiles', { 
            mensajes: req.flash("mensajes"), 
            usuarios: usuarios 
        });
    } catch (error) {
        req.flash('mensajes', 'Error al cargar los usuarios'); // Mensaje simple
        res.redirect('/'); // Redirigir a otra página o mostrar un error
    }
};

const cargarperfilajeno = async (req, res) => {
    try {
        const userId = req.params.id;  // Obtener el id desde los parámetros de la URL

        // Validar si el userId es un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            req.flash('mensajes', 'ID de usuario no válido');
            return res.redirect('/');  // Redirigir a otra página o mostrar un error
        }

        // Buscar el usuario en la base de datos
        const usuario = await users.findById(userId).lean();
        if (!usuario) {
            req.flash('mensajes', 'Usuario no encontrado');
            return res.redirect('/');
        }

        // Buscar las URLs asociadas
        const urls = await Publics.find({ user: userId }).lean();
        const comments = await Comment.find({ profileId: userId })
        .populate('userId', 'userName')
        .lean();
        // Renderizar la vista del perfil del usuario encontrado
        res.render('perfilEncontrado', { 
            usuario: usuario, 
            urls: urls, 
            imagen: usuario.foto,
            comments,
            mensajes: req.flash("mensajes") // Agregar mensajes a la vista
        });
    } catch (error) {
       
        req.flash('mensajes', 'Error al cargar el perfil del usuario');
        res.redirect('/');
    }
};

const obtenerSugerencias = async (req, res) => {
    const query = req.query.q;

    try {
        // Buscar usuarios que coincidan con el nombre
        const buscados = await users.find({ userName: { $regex: query, $options: 'i' } })
            .limit(5)
            .lean();

        // Enviar la lista de usuarios encontrados a la vista
        res.render('sugerido', {
            usuarios: buscados, // Enviar todo el array de usuarios
            mensajes: req.flash('mensajes')
        });
    } catch (error) {
        
        res.status(500).json({ 'error': 'Error interno del servidor' });
    }
};

const addComment = async (req, res) => {
    try {
        const { profileId, stars, commentaries } = req.body;

        // Crear un nuevo comentario
        const newComment = new Comment({ 
            userId: req.user.id, 
            profileId, 
            stars, 
            commentaries 
        });
        
        // Guardar el comentario en la base de datos
        await newComment.save();
        
        req.flash('success', 'Comentario agregado con éxito'); // Cambiar a un solo mensaje
        res.redirect('/profile');
    } catch (error) {
       
        req.flash('error', 'Error al agregar el comentario');
        res.redirect('/profile');
    }
};

// Controllers/ventaController.js
const addVenta = async (req, res) => {
    try {
        let objectDate= new Date();
        const { products, total } = req.body;
        const userId = req.user.id; // Asume que el usuario está autenticado
        // Crear una nueva venta
        const newVenta = new Venta({
            userId,
            products,
            total,
            date: objectDate.toLocaleString() // Establece la fecha actual
        });
        await newVenta.save();

        req.flash('success', 'Venta registrada con éxito'); // Cambiar a un solo mensaje
        res.redirect('/profile');
    } catch (error) {
     
        req.flash('error', 'Error al guardar la venta');
        res.redirect('/profile'); // Corregido el typo aquí
    }
};

// controllers/ventaController.js
const getVentas = async (req, res) => {
    try {
        const ventas = await Venta.find().populate('userId', 'userName').populate('products.productId', 'name').lean();

        res.render('ventas', { ventas, mensajes: req.flash('mensajes') }); // Pasar mensajes a la vista
    } catch (error) {
       
        req.flash('error', 'Error al obtener las ventas');
        res.redirect('/'); // Redirigir a otra página o mostrar un error
    }
};

const getReporteVentas = async (req, res) => {
    try {
        const userId = req.user.id; // Asume que el middleware de autenticación agrega el usuario a req.user
        
        const ventas = await Venta.find({ userId: userId }).populate('userId', 'userName').lean();

        if (ventas.length === 0) {
            req.flash('error', 'No se encontraron ventas para este usuario.');
            return res.redirect('/profile'); // Corregido el typo aquí
        }

        // Crear el documento PDF
        const doc = new PDFDocument();
        const filePath = path.join(__dirname, '..', 'reporteVentas.pdf');

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Título del PDF
        doc.fontSize(16).text('Reporte de Ventas', { align: 'center' });
        doc.moveDown();

        // Tabla de ventas
        ventas.forEach((venta, index) => {
            doc.text(`Venta ${index + 1}`, { underline: true });
            doc.text(`Usuario: ${venta.userId.userName}`);
            doc.text(`Productos: ${venta.products}`);
            doc.text(`Total: $${venta.total}`);
            doc.text(`Fecha: ${venta.date}`);
            doc.moveDown();
        });

        doc.end();

        stream.on('finish', () => {
            res.download(filePath, 'reporteVentas.pdf', (err) => {
                if (err) {
                   
                    req.flash('error', 'Error al descargar el archivo');
                    return res.redirect('/profile'); // Corregido el typo aquí
                }
                fs.unlinkSync(filePath);
            });
        });

    } catch (error) {
        
        req.flash('error', 'Error al generar el reporte');
        res.redirect('/profile'); // Corregido el typo aquí
    }
};



module.exports = {
    cargaBusqueda,
    cargarperfilajeno,
    obtenerSugerencias,
    addComment,
    addVenta,
    getVentas,
    getReporteVentas,
};
