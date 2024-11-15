// auth.js
import bcrypt from 'bcryptjs';
import db from './database.js';
import validator from 'validator';

// Función para registrar un nuevo usuario
async function registerUser(name, lastname, email, password, role) {
  try {
    // Validate input
    if (!validator.isEmail(email)) {
      throw new Error('Correo electrónico no válido');
    }
    if (!validator.isStrongPassword(password)) {
      throw new Error('La contraseña no es lo suficientemente fuerte');
    }

    // Verificar si el email ya existe
    const [existingUser] = await db.query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      throw new Error('El correo electrónico ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (first_name, last_name, email, password, role) VALUES (?, ?, ?, ?, ?)',
      [name, lastname, email, hashedPassword, role]
    );
    return { userId: result.insertId };
  } catch (err) {
    console.error('Error en el registro:', err);
    throw new Error('Error al registrar el usuario');
  }
}

// Función para iniciar sesión
async function loginUser(email, password, req) {
  try {
    // Validate session object early
    if (!req || !req.session) {
      console.error('Session object not available');
      throw new Error('Sesión no disponible');
    }

    // Validate input
    if (!validator.isEmail(email)) {
      throw new Error('Correo electrónico no válido');
    }

    // Consultar si el usuario existe en la base de datos
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Contraseña incorrecta');
    }

    // Configure session cookie for domain
    req.session.cookie.secure = true; // For HTTPS
    req.session.cookie.sameSite = 'strict';
    req.session.cookie.domain = 'inspire-iq.onrender.com'; // Set your domain
    req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Set session data
    req.session.userId = user.user_id;
    req.session.userRole = user.role;
    req.session.authenticated = true;
    req.session.lastAccess = new Date();

    console.log('Session data before save:', {
      id: req.session.id,
      userId: req.session.userId,
      userRole: req.session.userRole,
      authenticated: req.session.authenticated,
      cookie: req.session.cookie
    });

    // Save session with Promise wrapper
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          reject(new Error('Error al guardar la sesión'));
        }
        console.log('Session saved successfully');
        resolve();
      });
    });

    return {
      userId: user.user_id,
      role: user.role,
      sessionId: req.session.id
    };
  } catch (err) {
    console.error('Login error details:', err);
    throw new Error('Error al iniciar sesión: ' + (err.message || 'Error desconocido'));
  }
}

// Función para cerrar sesión
function logoutUser(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy(err => {
      if (err) {
        console.error('Error al cerrar sesión:', err);
        return reject(new Error('Error al cerrar sesión'));
      }
      resolve();
    });
  });
}

// Función para obtener un usuario por su ID
async function getUserById(userId) {
  try {
    // Buscar el usuario por su ID en la base de datos
    const [users] = await db.query('SELECT * FROM users WHERE user_id = ?', [userId]);
    if (users.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    // Excluir la contraseña en la respuesta
    const { password, ...userWithoutPassword } = users[0];
    return userWithoutPassword;
  } catch (err) {
    console.error('Error al obtener el usuario:', err);
    throw new Error('Error al obtener el usuario');
  }
}

// Función para obtener el progreso del usuario en los cursos
async function getUserCourseProgress(userId) {
  try {
    // Consulta para obtener el progreso del usuario en los cursos
    const [coursesProgress] = await db.query(
      'SELECT c.name, cp.progress FROM course_progress cp JOIN courses c ON cp.course_id = c.course_id WHERE cp.user_id = ?',
      [userId]
    );

    if (coursesProgress.length === 0) {
      return [];
    }

    return coursesProgress;
  } catch (err) {
    console.error('Error al obtener el progreso de los cursos:', err);
    throw new Error('Error al obtener el progreso de los cursos');
  }
}

// Función para obtener los enlaces sociales del usuario
async function getUserLinks(userId) {
  try {
    // Incluye el campo `link_id` en la consulta
    const [userLinks] = await db.query(
      'SELECT link_id, link_name, link_url FROM user_links WHERE user_id = ?',
      [userId]
    );

    return userLinks;  // Devuelve los resultados, incluyendo el `link_id`
  } catch (err) {
    console.error('Error al obtener los enlaces del usuario:', err);
    throw new Error('Error al obtener los enlaces del usuario');
  }
}

export { registerUser, loginUser, logoutUser, getUserById, getUserCourseProgress, getUserLinks };



