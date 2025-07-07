from flask import Flask, render_template, request, jsonify
import sqlite3
import os
from datetime import datetime

app = Flask(__name__)

# Configuração do banco de dados
DATABASE = 'database.db'

def get_db():
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    return db

def init_db():
    with app.app_context():
        if os.path.exists(DATABASE):
            os.remove(DATABASE)  # Remove o banco existente para recriação
            
        db = get_db()
        cursor = db.cursor()
        
        # Criar tabelas
        cursor.execute('''
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE publications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                image TEXT NOT NULL,
                location TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE interactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                publication_id INTEGER NOT NULL,
                like INTEGER DEFAULT 0,
                dislike INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(publication_id) REFERENCES publications(id),
                UNIQUE(user_id, publication_id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                publication_id INTEGER NOT NULL,
                comment TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(publication_id) REFERENCES publications(id)
            )
        ''')
        
        # Inserir dados iniciais
        publications = [
            ('Feijoada Completa', 'Prato típico brasileiro', 'prato1.jpg', 'São Paulo - SP'),
            ('Moqueca de Peixe', 'Prato típico da Bahia', 'prato2.jpg', 'Salvador - BA'),
            ('Churrasco Gaúcho', 'Prato típico do Rio Grande do Sul', 'prato3.jpg', 'Porto Alegre - RS')
        ]
        cursor.executemany(
            'INSERT INTO publications (title, description, image, location) VALUES (?, ?, ?, ?)',
            publications
        )
        
        # Inserir um usuário de teste (opcional)
        cursor.execute(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            ('Usuário Teste', 'teste@example.com', '123456')
        )
        
        db.commit()
        db.close()

init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    try:
        db = get_db()
        cursor = db.cursor()
        
        cursor.execute('SELECT * FROM users WHERE email = ? AND password = ?', (email, password))
        user = cursor.fetchone()
        
        if user:
            return jsonify({
                'success': True,
                'user': {
                    'id': user['id'],
                    'name': user['name'],
                    'email': user['email']
                }
            })
        else:
            return jsonify({'success': False, 'message': 'Credenciais inválidas'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})
    finally:
        db.close()

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    
    if not name or not email or not password:
        return jsonify({'success': False, 'message': 'Todos os campos são obrigatórios'})
    
    try:
        db = get_db()
        cursor = db.cursor()
        
        cursor.execute('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', 
                      (name, email, password))
        db.commit()
        
        # Obter o usuário recém-criado
        cursor.execute('SELECT * FROM users WHERE email = ?', (email,))
        user = cursor.fetchone()
        
        return jsonify({
            'success': True,
            'user': {
                'id': user['id'],
                'name': user['name'],
                'email': user['email']
            }
        })
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'message': 'Email já cadastrado'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})
    finally:
        db.close()

@app.route('/logout', methods=['POST'])
def logout():
    return jsonify({'success': True})

@app.route('/publications')
def get_publications():
    try:
        db = get_db()
        cursor = db.cursor()
        
        cursor.execute('''
            SELECT p.id, p.title, p.description, p.image, p.location,
                   COALESCE(SUM(i.like), 0) as likes,
                   COALESCE(SUM(i.dislike), 0) as dislikes,
                   COUNT(c.id) as comments
            FROM publications p
            LEFT JOIN interactions i ON p.id = i.publication_id
            LEFT JOIN comments c ON p.id = c.publication_id
            GROUP BY p.id
            ORDER BY p.created_at DESC
        ''')
        
        publications = [dict(row) for row in cursor.fetchall()]
        return jsonify(publications)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/like', methods=['POST'])
def like():
    data = request.get_json()
    publication_id = data.get('publicationId')
    user_id = data.get('userId')
    
    if not publication_id or not user_id:
        return jsonify({'success': False, 'message': 'Dados incompletos'}), 400
    
    try:
        db = get_db()
        cursor = db.cursor()
        
        # Verificar se já existe interação
        cursor.execute('''
            SELECT like, dislike FROM interactions 
            WHERE user_id = ? AND publication_id = ?
        ''', (user_id, publication_id))
        
        interaction = cursor.fetchone()
        user_has_liked = False
        
        if interaction:
            current_like, current_dislike = interaction
            if current_like == 1:
                # Já deu like, então remove
                cursor.execute('''
                    UPDATE interactions SET like = 0 
                    WHERE user_id = ? AND publication_id = ?
                ''', (user_id, publication_id))
            else:
                # Não deu like ou deu dislike
                cursor.execute('''
                    UPDATE interactions SET like = 1, dislike = 0 
                    WHERE user_id = ? AND publication_id = ?
                ''', (user_id, publication_id))
                user_has_liked = True
        else:
            # Nova interação
            cursor.execute('''
                INSERT INTO interactions (user_id, publication_id, like, dislike)
                VALUES (?, ?, 1, 0)
            ''', (user_id, publication_id))
            user_has_liked = True
        
        db.commit()
        
        # Obter nova contagem de likes
        cursor.execute('''
            SELECT COALESCE(SUM(like), 0) as likes
            FROM interactions 
            WHERE publication_id = ?
        ''', (publication_id,))
        
        new_count = cursor.fetchone()['likes']
        
        # Obter total de likes para o usuário
        cursor.execute('''
            SELECT COALESCE(SUM(like), 0) as user_likes
            FROM interactions 
            WHERE user_id = ?
        ''', (user_id,))
        
        user_likes = cursor.fetchone()['user_likes']
        
        return jsonify({
            'success': True,
            'newCount': new_count,
            'userLikes': user_likes,
            'userHasLiked': user_has_liked
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()

@app.route('/dislike', methods=['POST'])
def dislike():
    data = request.get_json()
    publication_id = data.get('publicationId')
    user_id = data.get('userId')
    
    if not publication_id or not user_id:
        return jsonify({'success': False, 'message': 'Dados incompletos'}), 400
    
    try:
        db = get_db()
        cursor = db.cursor()
        
        # Verificar se já existe interação
        cursor.execute('''
            SELECT like, dislike FROM interactions 
            WHERE user_id = ? AND publication_id = ?
        ''', (user_id, publication_id))
        
        interaction = cursor.fetchone()
        user_has_disliked = False
        
        if interaction:
            current_like, current_dislike = interaction
            if current_dislike == 1:
                # Já deu dislike, então remove
                cursor.execute('''
                    UPDATE interactions SET dislike = 0 
                    WHERE user_id = ? AND publication_id = ?
                ''', (user_id, publication_id))
            else:
                # Não deu dislike ou deu like
                cursor.execute('''
                    UPDATE interactions SET dislike = 1, like = 0 
                    WHERE user_id = ? AND publication_id = ?
                ''', (user_id, publication_id))
                user_has_disliked = True
        else:
            # Nova interação
            cursor.execute('''
                INSERT INTO interactions (user_id, publication_id, like, dislike)
                VALUES (?, ?, 0, 1)
            ''', (user_id, publication_id))
            user_has_disliked = True
        
        db.commit()
        
        # Obter nova contagem de dislikes
        cursor.execute('''
            SELECT COALESCE(SUM(dislike), 0) as dislikes
            FROM interactions 
            WHERE publication_id = ?
        ''', (publication_id,))
        
        new_count = cursor.fetchone()['dislikes']
        
        # Obter total de dislikes para o usuário
        cursor.execute('''
            SELECT COALESCE(SUM(dislike), 0) as user_dislikes
            FROM interactions 
            WHERE user_id = ?
        ''', (user_id,))
        
        user_dislikes = cursor.fetchone()['user_dislikes']
        
        return jsonify({
            'success': True,
            'newCount': new_count,
            'userDislikes': user_dislikes,
            'userHasDisliked': user_has_disliked
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()

@app.route('/interactions', methods=['GET'])
def get_interactions():
    user_id = request.args.get('userId')
    publication_id = request.args.get('publicationId')
    
    if not user_id or not publication_id:
        return jsonify({'error': 'Parâmetros faltando'}), 400
    
    try:
        db = get_db()
        cursor = db.cursor()
        
        cursor.execute('''
            SELECT like, dislike FROM interactions
            WHERE user_id = ? AND publication_id = ?
        ''', (user_id, publication_id))
        
        interaction = cursor.fetchone()
        
        if interaction:
            return jsonify({
                'like': bool(interaction['like']),
                'dislike': bool(interaction['dislike'])
            })
        else:
            return jsonify({'like': False, 'dislike': False})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/comments', methods=['GET'])
def get_comments():
    publication_id = request.args.get('publicationId')
    
    if not publication_id:
        return jsonify({'error': 'ID da publicação não fornecido'}), 400
    
    try:
        db = get_db()
        cursor = db.cursor()
        
        cursor.execute('''
            SELECT c.id, c.comment, c.created_at, u.name as user_name, u.email as user_email
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.publication_id = ?
            ORDER BY c.created_at DESC
        ''', (publication_id,))
        
        comments = [dict(row) for row in cursor.fetchall()]
        return jsonify(comments)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/comment', methods=['POST'])
def add_comment():
    data = request.get_json()
    publication_id = data.get('publicationId')
    user_id = data.get('userId')
    comment_text = data.get('comment')
    
    if not publication_id or not user_id or not comment_text:
        return jsonify({'success': False, 'message': 'Dados incompletos'}), 400
    
    try:
        db = get_db()
        cursor = db.cursor()
        
        # Inserir o comentário
        cursor.execute('''
            INSERT INTO comments (user_id, publication_id, comment)
            VALUES (?, ?, ?)
        ''', (user_id, publication_id, comment_text))
        
        db.commit()
        
        # Obter o comentário recém-criado com informações do usuário
        cursor.execute('''
            SELECT c.id, c.comment, c.created_at, u.name as user_name, u.email as user_email
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = last_insert_rowid()
        ''')
        
        new_comment = dict(cursor.fetchone())
        
        # Atualizar contagem de comentários
        cursor.execute('''
            SELECT COUNT(id) as comment_count
            FROM comments
            WHERE publication_id = ?
        ''', (publication_id,))
        
        comment_count = cursor.fetchone()['comment_count']
        
        return jsonify({
            'success': True,
            'comment': new_comment,
            'commentCount': comment_count
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()

@app.route('/comment/<int:comment_id>', methods=['PUT'])
def update_comment(comment_id):
    data = request.get_json()
    user_id = data.get('userId')
    new_text = data.get('comment')
    
    if not user_id or not new_text:
        return jsonify({'success': False, 'message': 'Dados incompletos'}), 400
    
    try:
        db = get_db()
        cursor = db.cursor()
        
        # Verificar se o comentário pertence ao usuário
        cursor.execute('''
            SELECT id FROM comments
            WHERE id = ? AND user_id = ?
        ''', (comment_id, user_id))
        
        if not cursor.fetchone():
            return jsonify({'success': False, 'message': 'Comentário não encontrado ou não pertence ao usuário'}), 404
        
        # Atualizar o comentário
        cursor.execute('''
            UPDATE comments SET comment = ?
            WHERE id = ?
        ''', (new_text, comment_id))
        
        db.commit()
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()

@app.route('/comment/<int:comment_id>', methods=['DELETE'])
def delete_comment(comment_id):
    user_id = request.args.get('userId')
    
    if not user_id:
        return jsonify({'success': False, 'message': 'ID do usuário não fornecido'}), 400
    
    try:
        db = get_db()
        cursor = db.cursor()
        
        # Verificar se o comentário pertence ao usuário
        cursor.execute('''
            SELECT id, publication_id FROM comments
            WHERE id = ? AND user_id = ?
        ''', (comment_id, user_id))
        
        comment = cursor.fetchone()
        if not comment:
            return jsonify({'success': False, 'message': 'Comentário não encontrado ou não pertence ao usuário'}), 404
        
        publication_id = comment['publication_id']
        
        # Excluir o comentário
        cursor.execute('''
            DELETE FROM comments
            WHERE id = ?
        ''', (comment_id,))
        
        db.commit()
        
        # Obter nova contagem de comentários
        cursor.execute('''
            SELECT COUNT(id) as comment_count
            FROM comments
            WHERE publication_id = ?
        ''', (publication_id,))
        
        comment_count = cursor.fetchone()['comment_count']
        
        return jsonify({
            'success': True,
            'commentCount': comment_count
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        db.close()

@app.route('/stats')
def get_stats():
    user_id = request.args.get('userId')
    
    try:
        db = get_db()
        cursor = db.cursor()
        
        # Estatísticas totais
        cursor.execute('''
            SELECT 
                COALESCE(SUM(like), 0) as total_likes,
                COALESCE(SUM(dislike), 0) as total_dislikes,
                COUNT(DISTINCT publication_id) as total_publications,
                (SELECT COUNT(id) FROM users) as total_users,
                (SELECT COUNT(id) FROM comments) as total_comments
            FROM interactions
        ''')
        
        stats = dict(cursor.fetchone())
        
        if user_id:
            # Estatísticas do usuário
            cursor.execute('''
                SELECT 
                    COALESCE(SUM(like), 0) as user_likes,
                    COALESCE(SUM(dislike), 0) as user_dislikes,
                    COUNT(DISTINCT publication_id) as user_interactions
                FROM interactions 
                WHERE user_id = ?
            ''', (user_id,))
            
            user_stats = dict(cursor.fetchone())
            stats.update(user_stats)
            
            # Comentários do usuário
            cursor.execute('''
                SELECT COUNT(id) as user_comments
                FROM comments
                WHERE user_id = ?
            ''', (user_id,))
            
            user_comments = cursor.fetchone()['user_comments']
            stats['user_comments'] = user_comments
        
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

if __name__ == '__main__':
    app.run(debug=True)