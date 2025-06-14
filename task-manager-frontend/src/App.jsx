// src/App.jsx
// frontend
import React, { useEffect, useState } from 'react';

const API_URL = 'http://localhost:3001';

function App() {
  const [token, setToken] = useState(null);
  const [role, setRole] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const [tasks, setTasks] = useState([]);
    
  async function login() {
    setError('');
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
		localStorage.setItem('token', data.token);
        setToken(data.token);
        setRole(data.user.role);
      } else {
        setError(data.error || 'Ошибка входа');
      }
    } catch {
      setError('Ошибка сервера');
    }
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 300, margin: 'auto', padding: 20 }}>
        <h2>Вход</h2>
        <input placeholder="Логин" value={username} onChange={e => setUsername(e.target.value)} />
        <input type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} />
        <button onClick={login}>Войти</button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    );
  }

  if (role === 'admin') {
    return (
      <div style={{ padding: 20 }}>
        <h1>Панель администратора</h1>
        {/* Здесь будет управление сотрудниками и задачами */}
        
			
		<CreateTaskForm token={localStorage.getItem('token')} />
		<TasksList token={localStorage.getItem('token')} role={role} />
		<UsersList token={localStorage.getItem('token')} />
		<CreateUserForm token={localStorage.getItem('token')} />
      </div>
	 
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Панель работника</h2>
      {/* Здесь будет список заданий и кнопки */}
      <p>Добро пожаловать, работник!</p>
	  <TasksList token={localStorage.getItem('token')} role={role} />
    </div>
  );
}

function CreateUserForm({ token }) {
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'worker' });
  const [status, setStatus] = useState('');

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3001/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        setStatus('✅ Пользователь создан');
        setForm({ name: '', username: '', password: '', role: 'worker' });
      } else {
        const data = await res.json();
        setStatus('❌ Ошибка: ' + data.message);
      }
    } catch (err) {
      setStatus('❌ Ошибка соединения');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>Создать пользователя</h3>
      <input name="name" placeholder="Имя" value={form.name} onChange={handleChange} />
      <input name="username" placeholder="Логин" value={form.username} onChange={handleChange} />
      <input name="password" placeholder="Пароль" type="password" value={form.password} onChange={handleChange} />
      <select name="role" value={form.role} onChange={handleChange}>
        <option value="worker">Работник</option>
        <option value="admin">Администратор</option>
      </select>
      <button type="submit">Создать</button>
      <div>{status}</div>
    </form>
  );
}

function CreateTaskForm({ token }) {
  const [task, setTask] = useState({
    title: '',
    description: '',
    due_date: '',
    assignees: []
  });
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState('');

  // Загрузка пользователей при загрузке формы
  useEffect(() => {
    fetch('http://localhost:3001/all-users', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setUsers(data));
  }, [token]);

  const handleChange = e => {
    setTask({ ...task, [e.target.name]: e.target.value });
  };

  const handleAssigneeToggle = id => {
    setTask(prev => {
      const newList = prev.assignees.includes(id)
        ? prev.assignees.filter(uid => uid !== id)
        : [...prev.assignees, id];
      return { ...prev, assignees: newList };
    });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const failedUsers = [];
  
      for (const userId of task.assignees) {
        const res = await fetch('http://localhost:3001/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: task.title,
            description: task.description,
            due_date: task.due_date,
            assignees: [userId] // передаём одного исполнителя
          })
        });
  
        const data = await res.json();
        if (!res.ok) {
          failedUsers.push(userId);
          console.error(`Ошибка для пользователя ${userId}: ${data.message}`);
        }
      }
  
      if (failedUsers.length === 0) {
        setStatus('✅ Задачи созданы');
        setTask({ title: '', description: '', due_date: '', assignees: [] });
      } else {
        setStatus(`⚠️ Ошибка при создании задач для: ${failedUsers.join(', ')}`);
      }
    } catch {
      setStatus('❌ Ошибка соединения');
    }
  };
  return (
    <form onSubmit={handleSubmit}>
      <h2>Создать задачу</h2>
      <input name="title" placeholder="Заголовок" value={task.title} onChange={handleChange} />
      <input name="due_date" type="date" value={task.due_date} onChange={handleChange} />
	  
	  
	  <label>
		  <h4>
		  Описание:
		  </h4>
		  <textarea
			value={task.description}
			onChange={e => setTask({ ...task, description: e.target.value })}
			rows={5}
			style={{ width: '70%', resize: 'none' }}
			placeholder="Введите описание задания..."
		  />
	  </label>
      <div>
        <p>Назначить исполнителей:</p>
        {users.map(user => (
          <label key={user.id}>
            <input
              type="checkbox"
              checked={task.assignees.includes(user.id)}
              onChange={() => handleAssigneeToggle(user.id)}
            />
            {user.name} ({user.username})
          </label>
        ))}
      </div>
      <button type="submit">Создать задачу</button>
      <div>{status}</div>
    </form>
  );
}


function TasksList({ token, role }) {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('все');
  
  const [userFilter, setUserFilter] = useState('все');
  const [users, setUsers] = useState([]);

  useEffect(() => {
	  async function fetchData() {
		try {
		  const [tasksRes, usersRes] = await Promise.all([
			fetch('http://localhost:3001/tasks', {
			  headers: { 'Authorization': `Bearer ${token}` }
			}),
			role === 'admin' ? fetch('http://localhost:3001/users', {
			  headers: { 'Authorization': `Bearer ${token}` }
			}) : Promise.resolve({ json: async () => [] })
		  ]);

		  const tasksData = await tasksRes.json();
		  const usersData = role === 'admin' ? await usersRes.json() : [];

		  if (!tasksRes.ok) {
			setError(tasksData.error || 'Ошибка загрузки задач');
			return;
		  }

		  setTasks(tasksData);
		  if (role === 'admin') setUsers(usersData);
		} catch {
		  setError('Ошибка соединения');
		}
	  }

	  fetchData();
  }, [token, role]);

  const filteredTasks = tasks.filter(task => {
	if (filter !== 'все' && task.status !== filter) return false;
	if (userFilter !== 'все' && task.executors !== userFilter) return false;
	return true;
  });

  const markComplete = async (id) => {
    if (!window.confirm('Отправить на подтверждение?')) return;

    try {
      const res = await fetch(`http://localhost:3001/tasks/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'выполнено' })
      });

      if (res.ok) {
        setTasks(prev => prev.map(task => task.id === id ? { ...task, status: 'выполнено' } : task));
      } else {
        alert('Ошибка обновления статуса');
      }
    } catch {
      alert('Ошибка соединения');
    }
  };

  const changeStatus = async (id, status) => {
    try {
      const res = await fetch(`http://localhost:3001/tasks/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        setTasks(prev => prev.map(task => task.id === id ? { ...task, status } : task));
      } else {
        alert('Ошибка обновления статуса');
      }
    } catch {
      alert('Ошибка соединения');
    }
  };

  const deleteTask = async (id) => {
    if (!window.confirm('Удалить задачу?')) return;
  
    try {
      const res = await fetch(`http://localhost:3001/tasks/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
  
      if (res.ok) {
        setTasks(tasks.filter(task => task.id !== id));
      } else {
        alert('❌ ' + (data.message || 'Ошибка удаления'));
      }
    } catch {
      alert('❌ Ошибка соединения');
    }
  };

  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  // изменение цвета задач
  const getTaskRowStyle = (task) => {
	if (task.status === 'выполнено') return {};
	
	const today = new Date();
	const dueDate = new Date(task.due_date);
	const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
	
	if (diffDays < 0) {
		return { backgroundColor: '#ffcccc' }; // просрочено — красный
	} else if (diffDays <= 7) {
		return { backgroundColor: '#fff0b3' }; // неделя до срока — оранжевый
	}
	
	return {};
  };
  
  // сортировка списка задач
  const sortedTasks = [...filteredTasks].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  
  return (
    <div>
      <h2>Список задач</h2>

      <label>Фильтр по статусу: </label>
      <select value={filter} onChange={e => setFilter(e.target.value)}>
        <option value="все">Все</option>
        <option value="выполнено">Выполненные</option>
        <option value="не выполнено">Не выполненные</option>
      </select>
	  
	  {role === 'admin' && (
		<>
			<label> Фильтр по исполнителю: </label>
			<select value={userFilter} onChange={e => setUserFilter(e.target.value)}>
			  <option value="все">Все</option>
			  {users.map(user => (
				<option key={user.id} value={user.username}>{user.name} ({user.username})</option>
			  ))}
			</select>
		</>
	  )}
	  
	  
      {sortedTasks.length === 0 ? (
        <p>Задачи не найдены</p>
      ) : (
        <ul>
          {sortedTasks.map(task => (
            <li key={task.id} style={getTaskRowStyle(task)}>
              <strong>{task.title}</strong> — исполнитель: {task.executors || 'не назначен'}, срок: {task.due_date}, статус: {task.status}
              {' '}
              {role === 'worker' && task.status !== 'выполнено' && (
                <button onClick={() => markComplete(task.id)}>Отметить как выполненное</button>
              )}
              {role === 'admin' && (
				<>
					<select value={task.status} onChange={e => changeStatus(task.id, e.target.value)}>
					  <option value="не выполнено">не выполнено</option>
					  <option value="выполнено">выполнено</option>
					</select>
					<button onClick={() => deleteTask(task.id)}>Удалить</button>
				</>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UsersList({ token }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [editUserId, setEditUserId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', username: '', role: 'worker' });

  const fetchUsers = async () => {
    try {
      const res = await fetch('http://localhost:3001/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setUsers(data);
    } catch {
      setError('Ошибка загрузки пользователей');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const deleteUser = async (id) => {
    if (!window.confirm('Удалить пользователя?')) return;
    try {
      const res = await fetch(`http://localhost:3001/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(users.filter(user => user.id !== id));
      } else {
        alert('❌ ' + data.message);
      }
    } catch {
      alert('❌ Ошибка соединения');
    }
  };

  const startEdit = (user) => {
    setEditUserId(user.id);
    setEditForm({ name: user.name, username: user.username, role: user.role });
  };

  const cancelEdit = () => {
    setEditUserId(null);
    setEditForm({ name: '', username: '', role: 'worker' });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const saveEdit = async (id) => {
    try {
      const res = await fetch(`http://localhost:3001/users/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(users.map(user => user.id === id ? { ...user, ...editForm } : user));
        cancelEdit();
      } else {
        alert('❌ ' + data.message);
      }
    } catch {
      alert('❌ Ошибка соединения');
    }
  };

  return (
    <div>
      <h2>Пользователи</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <table border="1" cellPadding="5" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Имя</th>
            <th>Логин</th>
            <th>Роль</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              {editUserId === user.id ? (
                <>
                  <td>
                    <input name="name" value={editForm.name} onChange={handleEditChange} />
                  </td>
                  <td>
                    <input name="username" value={editForm.username} onChange={handleEditChange} />
                  </td>
                  <td>
                    <select name="role" value={editForm.role} onChange={handleEditChange}>
                      <option value="worker">Работник</option>
                      <option value="admin">Администратор</option>
                    </select>
                  </td>
                  <td>
                    <button onClick={() => saveEdit(user.id)}>Сохранить</button>
                    <button onClick={cancelEdit}>Отмена</button>
                  </td>
                </>
              ) : (
                <>
                  <td>{user.name}</td>
                  <td>{user.username}</td>
                  <td>{user.role}</td>
                  <td>
                    <button onClick={() => startEdit(user)}>Редактировать</button>
                    <button onClick={() => deleteUser(user.id)}>Удалить</button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


export default App;
