import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query } from 'firebase/firestore';
import { setLogLevel } from "firebase/firestore";

// --- Firebase Configuration ---
const firebaseConfigString = process.env.REACT_APP_FIREBASE_CONFIG;
const firebaseConfig = firebaseConfigString ? JSON.parse(firebaseConfigString) : {};
const appId = process.env.REACT_APP_APP_ID || 'default-app-id';

// --- Initialize Firebase ---
let app;
let auth;
let db;

if (firebaseConfig && firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    setLogLevel('debug');
}


// --- Helper Functions ---
const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// --- Main App Component ---
export default function App() {
    const [tasks, setTasks] = useState([]);
    const [newTask, setNewTask] = useState('');
    const [newDueDate, setNewDueDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [editingTaskText, setEditingTaskText] = useState('');
    const [editingDueDate, setEditingDueDate] = useState('');
    const [firebaseReady, setFirebaseReady] = useState(false);

    // --- Authentication Effect ---
    useEffect(() => {
        if (!auth) {
            console.log("Firebase not configured. Waiting for config.");
            setLoading(false);
            return;
        }
        setFirebaseReady(true);
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
            } else {
                try {
                    await signInAnonymously(auth);
                } catch (error) {
                    console.error("Error signing in anonymously:", error);
                }
            }
        });
        return () => unsubscribe();
    }, []);

    // --- Firestore Data Fetching Effect ---
    useEffect(() => {
        if (!userId || !db) return;

        setLoading(true);
        const tasksCollectionPath = `artifacts/${appId}/users/${userId}/tasks`;
        const q = query(collection(db, tasksCollectionPath));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            tasksData.sort((a, b) => {
                const dateA = a.createdAt?.toDate() || 0;
                const dateB = b.createdAt?.toDate() || 0;
                return dateA - dateB;
            });
            setTasks(tasksData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching tasks:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    // --- Event Handlers ---
    const handleAddTask = async (e) => {
        e.preventDefault();
        if (newTask.trim() === '' || !userId || !db) return;
        try {
            const tasksCollectionPath = `artifacts/${appId}/users/${userId}/tasks`;
            await addDoc(collection(db, tasksCollectionPath), {
                text: newTask,
                completed: false,
                createdAt: new Date(),
                dueDate: newDueDate || null
            });
            setNewTask('');
            setNewDueDate('');
        } catch (error) {
            console.error("Error adding task: ", error);
        }
    };

    const handleToggleTask = async (id, completed) => {
        if (!userId || !db) return;
        const taskDocRef = doc(db, `artifacts/${appId}/users/${userId}/tasks`, id);
        try {
            await updateDoc(taskDocRef, { completed: !completed });
        } catch (error) {
            console.error("Error toggling task: ", error);
        }
    };

    const handleDeleteTask = async (id) => {
        if (!userId || !db) return;
        const taskDocRef = doc(db, `artifacts/${appId}/users/${userId}/tasks`, id);
        try {
            await deleteDoc(taskDocRef);
        } catch (error) {
            console.error("Error deleting task: ", error);
        }
    };

    const handleStartEdit = (task) => {
        setEditingTaskId(task.id);
        setEditingTaskText(task.text);
        setEditingDueDate(task.dueDate || '');
    };

    const handleCancelEdit = () => {
        setEditingTaskId(null);
        setEditingTaskText('');
        setEditingDueDate('');
    };

    const handleUpdateTask = async (id) => {
        if (!userId || editingTaskText.trim() === '' || !db) return;
        const taskDocRef = doc(db, `artifacts/${appId}/users/${userId}/tasks`, id);
        try {
            await updateDoc(taskDocRef, {
                text: editingTaskText,
                dueDate: editingDueDate || null
            });
            handleCancelEdit();
        } catch (error) {
            console.error("Error updating task: ", error);
        }
    };

    // --- Render UI ---
     if (!firebaseReady) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center font-sans p-4">
                <div className="text-center">
                    <h2 className="text-xl font-semibold">Configurando la aplicación...</h2>
                    <p className="text-gray-500">Asegúrate de haber añadido las variables de entorno en Vercel.</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-100 to-indigo-200 flex items-center justify-center font-sans p-4">
            <div className="w-full max-w-2xl bg-white/70 backdrop-blur-xl rounded-2xl shadow-2xl p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-2">
                    <h1 className="text-3xl font-bold text-gray-800">Mi Agenda</h1>
                    <div className="text-sm font-medium text-gray-600 bg-white/50 px-3 py-1 rounded-full">
                        {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                </div>

                <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row gap-3 mb-6">
                    <input
                        type="text"
                        value={newTask}
                        onChange={(e) => setNewTask(e.target.value)}
                        placeholder="Añadir una nueva tarea..."
                        className="flex-grow p-3 bg-white/80 border-2 border-transparent focus:border-blue-500 focus:ring-0 rounded-lg outline-none transition shadow-inner"
                    />
                    <input
                        type="datetime-local"
                        value={newDueDate}
                        onChange={(e) => setNewDueDate(e.target.value)}
                        className="p-3 bg-white/80 border-2 border-transparent focus:border-blue-500 focus:ring-0 rounded-lg outline-none transition shadow-inner"
                    />
                    <button type="submit" className="bg-blue-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-700 transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 shadow-lg">
                        Añadir
                    </button>
                </form>

                <div className="space-y-4">
                    {loading ? <p className="text-center text-gray-500">Cargando tareas...</p> : tasks.length === 0 ? (
                        <div className="text-center py-8 px-4 bg-white/50 rounded-lg">
                            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <h3 className="mt-2 text-sm font-medium text-gray-800">Todo despejado</h3>
                            <p className="mt-1 text-sm text-gray-500">¡Añade una tarea para empezar!</p>
                        </div>
                    ) : (
                        tasks.map(task => (
                            <div key={task.id} className={`p-4 rounded-lg transition-all duration-300 ${task.completed ? 'bg-green-100/70' : 'bg-white/60'}`}>
                                {editingTaskId === task.id ? (
                                    <div className="space-y-3">
                                        <input type="text" value={editingTaskText} onChange={(e) => setEditingTaskText(e.target.value)} className="w-full p-2 bg-white rounded-md shadow-inner"/>
                                        <input type="datetime-local" value={editingDueDate} onChange={(e) => setEditingDueDate(e.target.value)} className="w-full p-2 bg-white rounded-md shadow-inner"/>
                                        <div className="flex justify-end gap-2">
                                            <button onClick={handleCancelEdit} className="px-4 py-2 text-sm rounded-md text-gray-600 hover:bg-gray-200">Cancelar</button>
                                            <button onClick={() => handleUpdateTask(task.id)} className="px-4 py-2 text-sm rounded-md text-white bg-green-500 hover:bg-green-600">Guardar</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-start">
                                        <div className="flex-grow flex items-start">
                                            <div onClick={() => handleToggleTask(task.id, task.completed)} className={`flex-shrink-0 w-6 h-6 rounded-full border-2 mt-1 cursor-pointer ${task.completed ? 'bg-blue-500 border-blue-500' : 'border-gray-400'} flex items-center justify-center mr-4 transition-all`}>
                                                {task.completed && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                                            </div>
                                            <div className="flex-grow">
                                                <span className={`font-medium ${task.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>{task.text}</span>
                                                {task.dueDate && <p className="text-xs text-blue-600 font-semibold mt-1">{formatDate(task.dueDate)}</p>}
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0 flex items-center gap-2 ml-4">
                                            <button onClick={() => handleStartEdit(task)} className="text-gray-500 hover:text-blue-600 transition-colors">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>
                                            </button>
                                            <button onClick={() => handleDeleteTask(task.id)} className="text-gray-500 hover:text-red-600 transition-colors">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
