document.addEventListener('DOMContentLoaded', function() {
    // Elementos do DOM
    const loginBtn = document.getElementById('login-btn');
    const loginModal = document.getElementById('login-modal');
    const cancelBtn = document.getElementById('cancel-btn');
    const loginForm = document.getElementById('login-form');
    const registerLink = document.getElementById('register-link');
    const registerModal = document.getElementById('register-modal');
    const cancelRegBtn = document.getElementById('cancel-reg-btn');
    const registerForm = document.getElementById('register-form');
    
    // Variáveis de estado
    let isLoggedIn = false;
    let currentUser = null;
    let commentModal = null;
    let currentPublicationId = null;

    // Abrir modal de login
    loginBtn.addEventListener('click', function() {
        if (isLoggedIn) {
            logout();
        } else {
            loginModal.style.display = 'flex';
        }
    });
    
    // Fechar modal de login
    cancelBtn.addEventListener('click', function() {
        loginModal.style.display = 'none';
    });
    
    // Fechar modal de cadastro
    cancelRegBtn.addEventListener('click', function() {
        registerModal.style.display = 'none';
    });
    
    // Abrir modal de cadastro
    registerLink.addEventListener('click', function(e) {
        e.preventDefault();
        loginModal.style.display = 'none';
        registerModal.style.display = 'flex';
    });
    
    // Submissão do formulário de login
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                currentUser = data.user;
                isLoggedIn = true;
                updateUI();
                loginModal.style.display = 'none';
                loginForm.reset();
                document.getElementById('error-message').textContent = '';
                updateUserStats();
                checkUserInteractions();
            } else {
                document.getElementById('error-message').textContent = data.message || 'Usuário ou senha incorreto';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('error-message').textContent = 'Erro ao fazer login';
        });
    });
    
    // Submissão do formulário de cadastro
    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        
        fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                currentUser = data.user;
                isLoggedIn = true;
                registerModal.style.display = 'none';
                loginModal.style.display = 'none';
                registerForm.reset();
                document.getElementById('reg-error-message').textContent = '';
                updateUI();
                updateUserStats();
                checkUserInteractions();
            } else {
                document.getElementById('reg-error-message').textContent = data.message || 'Erro ao cadastrar';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            document.getElementById('reg-error-message').textContent = 'Erro ao cadastrar';
        });
    });
    
    // Função para fazer logout
    function logout() {
        fetch('/logout', {
            method: 'POST'
        })
        .then(() => {
            isLoggedIn = false;
            currentUser = null;
            updateUI();
            updateTotalStats();
            resetInteractionsUI();
        })
        .catch(error => {
            console.error('Error:', error);
        });
    }
    
    // Função para atualizar a UI com base no estado de login
    function updateUI() {
        if (isLoggedIn) {
            document.body.classList.add('logged-in');
            loginBtn.textContent = 'Sair';
            
            // Atualizar perfil do usuário
            const profileDiv = document.querySelector('.profile');
            profileDiv.innerHTML = `
                <div class="logo" style="width:80px;height:80px;background:#D97014;border-radius:50%;"></div>
                <div class="user-info">
                    <h2>${currentUser.name}</h2>
                    <div class="divider"></div>
                    <div class="stats">
                        <p>Meus Likes: <span id="user-likes">0</span></p>
                        <p>Meus Dislikes: <span id="user-dislikes">0</span></p>
                        <p>Meus Comentários: <span id="user-comments">0</span></p>
                    </div>
                </div>
            `;
        } else {
            document.body.classList.remove('logged-in');
            loginBtn.textContent = 'Entrar';
            
            // Restaurar perfil da empresa
            const profileDiv = document.querySelector('.profile');
            profileDiv.innerHTML = `
                <img src="/static/images/logo_sabor_do_brasil.png" alt="Logo Sabor do Brasil" class="logo">
                <h2>Sabor do Brasil</h2>
                <div class="divider"></div>
                <div class="stats">
                    <p>Likes: <span id="total-likes">0</span></p>
                    <p>Dislikes: <span id="total-dislikes">0</span></p>
                    <p>Comentários: <span id="total-comments">0</span></p>
                </div>
            `;
        }
    }
    
    // Manipuladores de interação (like, dislike)
    document.querySelectorAll('.like-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (!isLoggedIn) {
                loginModal.style.display = 'flex';
                return;
            }
            
            const publicationId = this.closest('.publication').dataset.id;
            const likeCount = this.querySelector('.like-count');
            const dislikeBtn = this.closest('.interactions').querySelector('.dislike-btn');
            
            fetch('/like', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    publicationId, 
                    userId: currentUser.id 
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    likeCount.textContent = data.newCount;
                    
                    // Atualiza o estado visual
                    if (data.userHasLiked) {
                        this.classList.add('active');
                        dislikeBtn.classList.remove('active');
                    } else {
                        this.classList.remove('active');
                    }
                    
                    updateUserStats();
                    updateTotalStats();
                }
            })
            .catch(error => {
                console.error('Error:', error);
            });
        });
    });
    
    document.querySelectorAll('.dislike-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (!isLoggedIn) {
                loginModal.style.display = 'flex';
                return;
            }
            
            const publicationId = this.closest('.publication').dataset.id;
            const dislikeCount = this.querySelector('.dislike-count');
            const likeBtn = this.closest('.interactions').querySelector('.like-btn');
            
            fetch('/dislike', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    publicationId, 
                    userId: currentUser.id 
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    dislikeCount.textContent = data.newCount;
                    
                    // Atualiza o estado visual
                    if (data.userHasDisliked) {
                        this.classList.add('active');
                        likeBtn.classList.remove('active');
                    } else {
                        this.classList.remove('active');
                    }
                    
                    updateUserStats();
                    updateTotalStats();
                }
            })
            .catch(error => {
                console.error('Error:', error);
            });
        });
    });
    
    // Função para verificar interações do usuário
    function checkUserInteractions() {
        if (!isLoggedIn) return;
        
        document.querySelectorAll('.publication').forEach(pub => {
            const publicationId = pub.dataset.id;
            
            fetch(`/interactions?userId=${currentUser.id}&publicationId=${publicationId}`)
            .then(response => response.json())
            .then(data => {
                const likeBtn = pub.querySelector('.like-btn');
                const dislikeBtn = pub.querySelector('.dislike-btn');
                
                if (data.like) {
                    likeBtn.classList.add('active');
                    dislikeBtn.classList.remove('active');
                } else if (data.dislike) {
                    dislikeBtn.classList.add('active');
                    likeBtn.classList.remove('active');
                } else {
                    likeBtn.classList.remove('active');
                    dislikeBtn.classList.remove('active');
                }
            })
            .catch(error => {
                console.error('Error checking interactions:', error);
            });
        });
    }
    
    // Função para resetar a UI das interações
    function resetInteractionsUI() {
        document.querySelectorAll('.like-btn, .dislike-btn').forEach(btn => {
            btn.classList.remove('active');
        });
    }
    
    // Função para abrir o modal de comentários
    function openCommentModal(publicationId) {
        currentPublicationId = publicationId;
        
        // Criar o modal se não existir
        if (!commentModal) {
            commentModal = document.createElement('div');
            commentModal.className = 'comment-modal';
            commentModal.innerHTML = `
                <div class="comment-modal-content">
                    <h3>Comentários</h3>
                    <div class="comments-list"></div>
                    <div class="comment-form">
                        <textarea id="comment-text" placeholder="Digite seu comentário..." required></textarea>
                        <div class="comment-actions">
                            <button id="submit-comment" class="comment-submit" disabled>Enviar</button>
                            <button id="close-comment-modal" class="comment-cancel">Fechar</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(commentModal);
            
            // Event listeners
            document.getElementById('submit-comment').addEventListener('click', submitComment);
            document.getElementById('close-comment-modal').addEventListener('click', closeCommentModal);
            
            // Habilitar/desabilitar botão com base no texto
            document.getElementById('comment-text').addEventListener('input', function() {
                document.getElementById('submit-comment').disabled = this.value.trim() === '';
            });
        }
        
        // Carregar comentários existentes
        loadComments(publicationId);
        
        // Mostrar o modal
        commentModal.style.display = 'flex';
        document.getElementById('comment-text').focus();
    }

    function closeCommentModal() {
        if (commentModal) {
            commentModal.style.display = 'none';
            document.getElementById('comment-text').value = '';
        }
    }

    function loadComments(publicationId) {
        if (!commentModal) return;
        
        fetch(`/comments?publicationId=${publicationId}`)
            .then(response => response.json())
            .then(comments => {
                const commentsList = commentModal.querySelector('.comments-list');
                commentsList.innerHTML = '';
                
                if (comments.length === 0) {
                    commentsList.innerHTML = '<p class="no-comments">Nenhum comentário ainda. Seja o primeiro a comentar!</p>';
                    return;
                }
                
                comments.forEach(comment => {
                    const commentElement = document.createElement('div');
                    commentElement.className = 'comment-item';
                    commentElement.innerHTML = `
                        <div class="comment-header">
                            <strong>${comment.user_name}</strong>
                            <small>${formatDate(comment.created_at)}</small>
                            ${currentUser && currentUser.id === comment.user_id ? 
                                `<div class="comment-actions">
                                    <button class="edit-comment" data-comment-id="${comment.id}">✏️</button>
                                    <button class="delete-comment" data-comment-id="${comment.id}">🗑️</button>
                                </div>` : ''}
                        </div>
                        <p class="comment-content">${comment.comment}</p>
                    `;
                    commentsList.appendChild(commentElement);
                });
                
                // Adicionar eventos para editar/excluir comentários
                document.querySelectorAll('.edit-comment').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const commentId = this.dataset.commentId;
                        editComment(commentId);
                    });
                });
                
                document.querySelectorAll('.delete-comment').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const commentId = this.dataset.commentId;
                        deleteComment(commentId);
                    });
                });
            })
            .catch(error => {
                console.error('Error loading comments:', error);
                const commentsList = commentModal.querySelector('.comments-list');
                commentsList.innerHTML = '<p class="error-message">Erro ao carregar comentários</p>';
            });
    }

    function submitComment() {
        if (!currentPublicationId || !currentUser) return;
        
        const commentText = document.getElementById('comment-text').value.trim();
        if (!commentText) return;
        
        fetch('/comment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                publicationId: currentPublicationId,
                userId: currentUser.id,
                comment: commentText
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                document.getElementById('comment-text').value = '';
                loadComments(currentPublicationId);
                
                // Atualizar contador de comentários
                const commentCount = document.querySelector(`.publication[data-id="${currentPublicationId}"] .comment-count`);
                if (commentCount) {
                    commentCount.textContent = data.commentCount;
                }
                
                // Atualizar estatísticas
                updateUserStats();
                updateTotalStats();
            }
        })
        .catch(error => {
            console.error('Error submitting comment:', error);
            alert('Erro ao enviar comentário');
        });
    }

    function editComment(commentId) {
        const commentElement = document.querySelector(`.comment-item [data-comment-id="${commentId}"]`).closest('.comment-item');
        const commentContent = commentElement.querySelector('.comment-content');
        const currentText = commentContent.textContent;
        
        commentContent.innerHTML = `
            <textarea class="edit-comment-text">${currentText}</textarea>
            <div class="edit-actions">
                <button class="save-edit" data-comment-id="${commentId}">Salvar</button>
                <button class="cancel-edit">Cancelar</button>
            </div>
        `;
        
        commentElement.querySelector('.save-edit').addEventListener('click', function() {
            const newText = commentElement.querySelector('.edit-comment-text').value.trim();
            if (newText && newText !== currentText) {
                updateComment(commentId, newText);
            } else {
                cancelEdit(commentElement, currentText);
            }
        });
        
        commentElement.querySelector('.cancel-edit').addEventListener('click', function() {
            cancelEdit(commentElement, currentText);
        });
    }

    function updateComment(commentId, newText) {
        fetch(`/comment/${commentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                comment: newText,
                userId: currentUser.id
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadComments(currentPublicationId);
            }
        })
        .catch(error => {
            console.error('Error updating comment:', error);
            alert('Erro ao atualizar comentário');
        });
    }

    function deleteComment(commentId) {
        if (confirm('Tem certeza que deseja excluir este comentário?')) {
            fetch(`/comment/${commentId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: currentUser.id
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    loadComments(currentPublicationId);
                    
                    // Atualizar contador de comentários
                    const commentCount = document.querySelector(`.publication[data-id="${currentPublicationId}"] .comment-count`);
                    if (commentCount) {
                        commentCount.textContent = parseInt(commentCount.textContent) - 1;
                    }
                    
                    // Atualizar estatísticas
                    updateUserStats();
                    updateTotalStats();
                }
            })
            .catch(error => {
                console.error('Error deleting comment:', error);
                alert('Erro ao excluir comentário');
            });
        }
    }

    function cancelEdit(commentElement, originalText) {
        commentElement.querySelector('.comment-content').innerHTML = originalText;
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    }
    
    // Função para atualizar estatísticas totais
    function updateTotalStats() {
        fetch('/stats')
        .then(response => response.json())
        .then(data => {
            document.getElementById('total-likes').textContent = data.total_likes;
            document.getElementById('total-dislikes').textContent = data.total_dislikes;
            document.getElementById('total-comments').textContent = data.total_comments;
        })
        .catch(error => {
            console.error('Error:', error);
        });
    }
    
    // Função para atualizar estatísticas do usuário
    function updateUserStats() {
        if (!isLoggedIn) return;
        
        fetch(`/stats?userId=${currentUser.id}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('user-likes').textContent = data.user_likes;
            document.getElementById('user-dislikes').textContent = data.user_dislikes;
            document.getElementById('user-comments').textContent = data.user_comments || 0;
        })
        .catch(error => {
            console.error('Error:', error);
        });
    }
    
    // Adicionar evento de clique aos botões de comentário
    document.querySelectorAll('.comment-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (!isLoggedIn) {
                loginModal.style.display = 'flex';
                return;
            }
            
            const publicationId = this.closest('.publication').dataset.id;
            openCommentModal(publicationId);
        });
    });
    
    // Carregar dados iniciais
    function loadInitialData() {
        fetch('/publications')
        .then(response => response.json())
        .then(data => {
            data.forEach(pub => {
                const pubElement = document.querySelector(`.publication[data-id="${pub.id}"]`);
                if (pubElement) {
                    pubElement.querySelector('.like-count').textContent = pub.likes;
                    pubElement.querySelector('.dislike-count').textContent = pub.dislikes;
                    pubElement.querySelector('.comment-count').textContent = pub.comments;
                }
            });
            
            updateTotalStats();
            
            if (isLoggedIn) {
                updateUserStats();
                checkUserInteractions();
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
    }
    
    // Inicializar
    loadInitialData();
});