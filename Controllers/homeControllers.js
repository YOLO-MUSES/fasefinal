const Publics = require('../models/Postings');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const formidable = require('formidable');
const users = require('../models/users');
const Comment = require('../models/commentSchema')
const Venta = require('../models/VentaModel')
const cloudinary = require('cloudinary').v2;


cloudinary.config({
    cloud_name: process.env.cloud_name, // Reemplaza con tu nombre de nube
    api_key: process.env.api_key,       // Reemplaza con tu API key
    api_secret: process.env.api_secret  // Reemplaza con tu API secret
});

const leerPublicaciones = async (req, res) => {
    try {
        const urls = await Publics.find().lean().populate('user'); // Cargar todas las publicaciones
        const user = await users.findById(req.user.id).lean(); // Cargar el usuario actual

        
        // Obtener mensajes de flash
        const successMessage = req.flash('success');
        const errorMessage = req.flash('error');

        return res.render('home', {
            publicaciones: urls, // Renombrado para ser más claro
            user: user,
            successMessage,
            errorMessage
        });
    } catch (error) {
        req.flash('error', 'Error al cargar las publicaciones');
        return res.redirect('/'); // Redirigir en caso de error
    }
};


const leermispublicaciones = async (req, res) => {
    try {
        const urls = await Publics.find({ user: req.user.id }).lean();
        const user = await users.findById(req.user.id).lean();

        // Obtener mensajes de flash
        const successMessage = req.flash('success');
        const errorMessage = req.flash('error');

        // Renderiza la vista 'profile'
        res.render('profile', { successMessage, errorMessage, urls: urls, user, imagen: user.foto });
    } catch (error) {
        req.flash('error', error.message);
        return res.redirect('/');
    }
};

const eliminarPost = async (req, res) => {
    const { id } = req.params;
    try {
        await Publics.findByIdAndDelete(id);
        req.flash('success', 'Publicación eliminada con éxito.');
        res.redirect('/');
    } catch (error) {
        req.flash('error', error.message);
        return res.redirect('/');
    }
};

const editarPostForm = async (req, res) => {
    try {
        const { id } = req.params;
        const publics = await Publics.findById(id).lean();

        // Obtener mensajes de flash
        const successMessage = req.flash('success');
        const errorMessage = req.flash('error');

        res.render('home', { publics, successMessage, errorMessage });
    } catch (error) {
        req.flash('error', error.message);
        return res.redirect('/');
    }
};

const editarPosting = async (req, res) => {
    try {
        const { id } = req.params;
        const { origin } = req.body;
        await Publics.findByIdAndUpdate(id, { origin });
        req.flash('success', 'Publicación actualizada con éxito.');
        res.redirect('/');
    } catch (error) {
        req.flash('error', error.message);
        return res.redirect('/');
    }
};

const cargarPerfil = async (req, res) => {
    try {
        const userId = req.user.id;

        // Buscar al usuario en la base de datos
        const user = await users.findById(userId).lean(); // Aplicar lean para obtener un objeto plano
        const urls = await Publics.find({user:userId}).lean().populate('user');

        // Buscar los comentarios y llenar el campo de usuario
        const comments = await Comment.find({ profileId: userId })
            .populate('userId', 'userName')
            .lean();

        // Buscar las ventas del usuario
        const ventas = await Venta.find({ userId })
            .populate('userId', 'userName') // Populate del usuario
            .lean(); // No es necesario el populate de productos ya que ahora es un campo de texto

        // Asegurarse de que el usuario no sea nulo y tiene la propiedad userName
        if (!user || !user.userName) {
            req.flash('error', 'Usuario no encontrado o sin nombre de usuario.');
            return res.redirect('/');
        }

        // Obtener mensajes de flash
        const successMessage = req.flash('success');
        const errorMessage = req.flash('error');

        // Renderizar la vista del perfil
        res.render('profile', {
            user, // Notación abreviada
            imagen: user.foto,
            urls,
            comments, // Pasar los comentarios a la vista
            ventas, // Pasar las ventas a la vista
            successMessage,
            errorMessage
        });
    } catch (error) {
       
        req.flash('error', 'Hubo un error al cargar el perfil.');
        return res.redirect('/');
    }
};
const PintoresPost = async (req, res) => {
    const form = new formidable.IncomingForm();

    form.parse(req, async (err, fields, files) => {
        try {
            if (err) {
                throw new Error("Error al procesar el formulario.");
            }

            const { Names } = fields;

            const fileKeys = Object.keys(files);
            if (!fileKeys.length) {
                throw new Error('Por favor agrega al menos una imagen.');
            }

            const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
            const processedImages = [];

            for (const key of fileKeys) {
                const fileArray = Array.isArray(files[key]) ? files[key] : [files[key]];

                for (const file of fileArray) {
                    if (!file.originalFilename) {
                        throw new Error('Uno de los archivos no tiene un nombre válido.');
                    }

                    if (!validMimeTypes.includes(file.mimetype.toLowerCase())) {
                        throw new Error(`El archivo ${file.originalFilename} no es un tipo de imagen válido (JPG, JPEG, PNG).`);
                    }

                    if (file.size > 5 * 1024 * 1024) { // 5MB
                        throw new Error(`El archivo ${file.originalFilename} es mayor a 5MB.`);
                    }

                    try {
                        // Subir imagen a Cloudinary
                        const result = await cloudinary.uploader.upload(file.filepath, {
                            folder: 'Publicaciones/artesymas',
                            transformation: [{ width: 600, height: 600, crop: 'fit', quality: 80 }]
                        });

                        processedImages.push(result.secure_url);
                    } catch (error) {
                        throw new Error(`Error al subir la imagen ${file.originalFilename} a Cloudinary: ${error.message}`);
                    }
                }
            }

            const user = await users.findById(req.user.id);
            const publics = new Publics({
                name: Names || "pablitos",
                Imagen: processedImages,
                user: req.user.id
            });

            await publics.save();
            req.flash('success', 'Publicación creada con éxito.');
            return res.redirect('/');
        } catch (error) {
            req.flash('error', error.message);
            return res.redirect("/");
        }
    });
};

const Perfil = async (req, res) => {
    const form = new formidable.IncomingForm();
    form.parse(req, async (err, fields, files) => {
        try {
            if (err) {
                throw new Error("Error al procesar el formulario.");
            }

            const fileArray = Array.isArray(files.myFile) ? files.myFile : [files.myFile];
            const file = fileArray[0]; // Asumimos que solo se sube un archivo para el perfil

            if (!file || !file.originalFilename) {
                throw new Error('Por favor selecciona una imagen válida.');
            }

            const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
            if (!validMimeTypes.includes(file.mimetype.toLowerCase())) {
                throw new Error('Tipo de archivo no permitido. Solo JPG, JPEG y PNG.');
            }

            // Subir la imagen a Cloudinary
            const result = await cloudinary.uploader.upload(file.filepath, {
                folder: 'Perfiles/fotodinamica', // Carpeta donde se almacenará la imagen en Cloudinary
                transformation: [{ width: 200, height: 200, crop: 'fit', quality: 80 }] // Ajustes de transformación
            });

            // Actualizar la URL de la foto en el perfil del usuario
            const user = await users.findById(req.user.id);
            user.foto = result.secure_url; // Guardar la URL segura de Cloudinary
            await user.save();

            req.flash('success', "Foto de perfil actualizada correctamente");
            return res.redirect('/profile');
        } catch (error) {
            req.flash('error', error.message);
            return res.redirect('/profile');
        }
    });
};


module.exports = {
    leerPublicaciones,
    eliminarPost,
    editarPostForm,
    editarPosting,
    Perfil,
    leermispublicaciones,
    PintoresPost,
    cargarPerfil,
};
