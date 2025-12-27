import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { 
  BookOpen, 
  Home, 
  Search, 
  Bookmark, 
  User, 
  Moon, 
  Sun, 
  ChevronLeft, 
  MoreHorizontal, 
  Check, 
  Play,
  ArrowRight,
  Sparkles,
  Headphones,
  Share2,
  MessageSquare,
  Send,
  StopCircle,
  X,
  Heart,
  MessageCircle,
  CornerDownRight,
  PenTool,
  Lock,
  FileText,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
  Mic,
  Type,
  Palette,
  Settings,
  LogOut,
  Bell,
  Globe,
  Clock,
  MapPin,
  Smartphone,
  Info,
  Copy,
  Music,
  Mail,
  Loader2
} from 'lucide-react';

// --- SUPABASE CONFIG ---
const supabaseUrl = 'https://efzdhiqdcakvmgxatvkx.supabase.co';
const supabaseKey = 'sb_publishable_sFtNz9hTE1PwZY9Ahnc3lQ_FaGiop51';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- APP ICON URL ---
// Using a Data URI to replicate the "WL" Orange Icon design without external hosting
const APP_ICON_URL = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiB2aWV3Qm94PSIwIDAgNTEyIDUxMiI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImdyYWQxIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj4KICAgICAgPHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6I0ZGQjM0NztzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojRkY4QzAwO3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMjgiIGZpbGw9InVybCgjZ3JhZDEpIi8+CiAgPHBhdGggZD0iTTQyMCAxMjAgUSA0NjAgMTIwIDQ3MCAxNjAgUSA0NzAgMTgwIDQ1MCAyMDAgTCA0MjAgMTIwIiBmaWxsPSIjRkZEMTgwIiBvcGFjaXR5PSIwLjUiLz4KICA8dGV4dCB4PSIyNTYiIHk9IjM1MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI4MCIgZm9udC13ZWlnaHQ9IjkwMCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPldMPC90ZXh0PgogIDxwYXRoIGQ9Ik0xNDAgNDIwIFEgMTAwIDQ2MCA2MCA0NDAgTCAxMjAgMzgwIiBmaWxsPSIjRkZEMTgwIiBvcGFjaXR5PSIwLjUiLz4KICA8Y2lyY2xlIGN4PSI0NTAiIGN5PSI4MCIgcj0iMjAiIGZpbGw9IiNGRkQxODAiIG9wYWNpdHk9IjAuNiIvPgo8L3N2Zz4=";

// --- TYPES & DATA ---

type ViewState = 'auth' | 'username_setup' | 'onboarding' | 'home' | 'reader' | 'quiz' | 'editor' | 'settings';
type TabState = 'home' | 'explore' | 'saved' | 'profile';

interface UserProfile {
  id?: string;
  username: string; // Added username
  targetLanguage: string;
  nativeLanguage: string;
  level: string;
  hobbies: string[];
  emailNotifications: boolean; // Added peristence
  reminderTime: string; // Added persistence
}

interface Comment {
  id: string;
  user: string;
  avatar: string;
  text: string;
  timeAgo: string;
  likes: number;
  isLiked?: boolean;
  replies?: Comment[]; 
}

interface Article {
  id: string;
  title: string;
  subtitle: string;
  author: string;
  timeAgo: string;
  level: string;
  tags: string[];
  imageUrl: string;
  content: string;
  authorAvatar: string;
  languageCode: string; 
  languageName: string; 
}

interface Question {
    type: string;
    q: string;
    options: string[];
    correctString: string;
}

// --- CONFIGURATION ---

const LANGUAGES = [
  { code: 'JP', name: 'Japanese', flag: '🇯🇵', system: 'JLPT', tts: 'ja-JP' },
  { code: 'EN', name: 'English', flag: '🇺🇸', system: 'CEFR', tts: 'en-US' },
  { code: 'ES', name: 'Spanish', flag: '🇪🇸', system: 'CEFR', tts: 'es-ES' },
  { code: 'FR', name: 'French', flag: '🇫🇷', system: 'CEFR', tts: 'fr-FR' },
  { code: 'DE', name: 'German', flag: '🇩🇪', system: 'CEFR', tts: 'de-DE' },
  { code: 'CN', name: 'Chinese', flag: '🇨🇳', system: 'HSK', tts: 'zh-CN' },
  { code: 'PT', name: 'Portuguese', flag: '🇧🇷', system: 'CEFR', tts: 'pt-BR' },
  { code: 'IT', name: 'Italian', flag: '🇮🇹', system: 'CEFR', tts: 'it-IT' },
  { code: 'RU', name: 'Russian', flag: '🇷🇺', system: 'CEFR', tts: 'ru-RU' },
];

const LEVEL_SYSTEMS: Record<string, { id: string, label: string, sub: string, color: string, ring: string }[]> = {
  'JLPT': [
    { id: 'N5', label: 'Absolute Beginner', sub: 'JLPT N5', color: 'bg-green-100 text-green-700', ring: 'ring-green-500' },
    { id: 'N4', label: 'Beginner', sub: 'JLPT N4', color: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-500' },
    { id: 'N3', label: 'Intermediate', sub: 'JLPT N3', color: 'bg-brand-100 text-brand-700', ring: 'ring-brand' },
    { id: 'N2', label: 'Advanced', sub: 'JLPT N2', color: 'bg-purple-100 text-purple-700', ring: 'ring-purple-500' },
    { id: 'N1', label: 'Proficient', sub: 'JLPT N1', color: 'bg-red-100 text-red-700', ring: 'ring-red-500' },
  ],
  'HSK': [
    { id: 'HSK 1', label: 'Absolute Beginner', sub: 'HSK Level 1', color: 'bg-green-100 text-green-700', ring: 'ring-green-500' },
    { id: 'HSK 2', label: 'Beginner', sub: 'HSK Level 2', color: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-500' },
    { id: 'HSK 3', label: 'Intermediate', sub: 'HSK Level 3', color: 'bg-brand-100 text-brand-700', ring: 'ring-brand' },
    { id: 'HSK 4', label: 'Upper Intermediate', sub: 'HSK Level 4', color: 'bg-purple-100 text-purple-700', ring: 'ring-purple-500' },
    { id: 'HSK 5', label: 'Advanced', sub: 'HSK Level 5', color: 'bg-orange-100 text-orange-700', ring: 'ring-orange-500' },
    { id: 'HSK 6', label: 'Proficient', sub: 'HSK Level 6', color: 'bg-red-100 text-red-700', ring: 'ring-red-500' },
  ],
  'CEFR': [
    { id: 'A1', label: 'Absolute Beginner', sub: 'CEFR A1', color: 'bg-green-100 text-green-700', ring: 'ring-green-500' },
    { id: 'A2', label: 'Beginner', sub: 'CEFR A2', color: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-500' },
    { id: 'B1', label: 'Intermediate', sub: 'CEFR B1', color: 'bg-brand-100 text-brand-700', ring: 'ring-brand' },
    { id: 'B2', label: 'Upper Intermediate', sub: 'CEFR B2', color: 'bg-purple-100 text-purple-700', ring: 'ring-purple-500' },
    { id: 'C1', label: 'Advanced', sub: 'CEFR C1', color: 'bg-orange-100 text-orange-700', ring: 'ring-orange-500' },
    { id: 'C2', label: 'Proficient', sub: 'CEFR C2', color: 'bg-red-100 text-red-700', ring: 'ring-red-500' },
  ]
};

const HOBBY_CATEGORIES = [
  { name: 'Entertainment', icon: '🎮', subcategories: ['Anime/Manga', 'Games', 'Movies', 'Music'] },
  { name: 'Knowledge', icon: '📚', subcategories: ['Science', 'History', 'Technology', 'Math'] },
  { name: 'Lifestyle', icon: '🌿', subcategories: ['Cooking', 'Travel', 'Health', 'Fashion'] },
  { name: 'Culture', icon: '⛩️', subcategories: ['Folklore', 'Literature', 'Art', 'Traditions'] }
];

// --- TRANSLATIONS ---

const TRANSLATIONS: Record<string, Record<string, string>> = {
    'English': {
        'username_q': 'What should we call you?',
        'username_ph': 'Enter your username',
        'native_q': 'What is your native language?',
        'target_q': 'What do you want to learn?',
        'level_q': 'What is your current level?',
        'interests_q': 'What are your interests?',
        'pick_3': 'Pick at least 3 topics you enjoy.',
        'continue': 'Continue',
        'get_started': 'Get Started',
        'daily_goal': 'Daily Goal',
        'write_story': 'Write a new story...',
        'explore': 'Explore Content',
        'saved': 'Saved Articles',
        'profile': 'Profile',
        'settings': 'Settings',
        'logout': 'Logout',
        'reminders': 'Daily Reminders',
        'reminders_time': 'Notification Time',
        'email_notif': 'Email Notifications',
        'reminders_desc': 'Set your daily study time.',
        'level_label': 'Level',
        'dark_mode': 'Dark Mode',
        'app_lang': 'App Language',
        'share': 'Share App',
        'no_articles': 'No articles found for your level/language.',
        'be_first': 'Be the first to write one!',
        'search_ph': 'Search articles, authors...',
        'writer_status': 'Writer Status',
        'verified': 'Verified Writer',
        'take_test': 'Take Proficiency Test',
        'streak': 'Streak',
        'you': 'You',
        'learning': 'Learning',
        'days': 'days',
        'choose_lang': 'Choose Language',
        'passed': 'Unlocked!',
        'failed': 'Test Failed',
        'score': 'Your score was',
        'congrats': 'Congratulations! You can now write stories.',
        'try_again': 'Try Again',
        'new_story': 'New Story Info',
        'write_content': 'Write Content',
        'highlight_vocab': 'Highlight Vocabulary',
        'publish': 'PUBLISH',
        'next': 'NEXT',
        'title': 'Title',
        'enter_title': 'Enter title...',
        'subtitle': 'Subtitle',
        'short_desc': 'Short description...',
        'category': 'Category',
        'select_cat': 'Select Category',
        'select_level': 'Select Level',
        'add_cover': 'Add Cover Image',
        'add_audio': 'Add Audio Clip',
        'optional': '(Optional)',
        'start_writing': 'Start writing your story here...',
        'tap_highlight': 'Tap a word to select it, then tap a level color below to highlight it.',
        'clear': 'Clear',
        'link_copied': 'Link copied to clipboard!'
    },
    'Portuguese': {
        'username_q': 'Como devemos chamar você?',
        'username_ph': 'Digite seu nome de usuário',
        'native_q': 'Qual é o seu idioma nativo?',
        'target_q': 'O que você quer aprender?',
        'level_q': 'Qual é o seu nível atual?',
        'interests_q': 'Quais são seus interesses?',
        'pick_3': 'Escolha pelo menos 3 tópicos.',
        'continue': 'Continuar',
        'get_started': 'Começar',
        'daily_goal': 'Meta Diária',
        'write_story': 'Escrever nova história...',
        'explore': 'Explorar Conteúdo',
        'saved': 'Artigos Salvos',
        'profile': 'Perfil',
        'settings': 'Configurações',
        'logout': 'Sair',
        'reminders': 'Lembretes Diários',
        'reminders_time': 'Horário da Notificação',
        'email_notif': 'Notificações por Email',
        'reminders_desc': 'Defina seu horário de estudo.',
        'level_label': 'Nível',
        'dark_mode': 'Modo Escuro',
        'app_lang': 'Idioma do App',
        'share': 'Compartilhar App',
        'no_articles': 'Nenhum artigo encontrado.',
        'be_first': 'Seja o primeiro a escrever!',
        'search_ph': 'Buscar artigos, autores...',
        'writer_status': 'Status de Escritor',
        'verified': 'Escritor Verificado',
        'take_test': 'Fazer Teste de Proficiência',
        'streak': 'Sequência',
        'you': 'Você',
        'learning': 'Aprendendo',
        'days': 'dias',
        'choose_lang': 'Escolher Idioma',
        'passed': 'Desbloqueado!',
        'failed': 'Teste Falhou',
        'score': 'Sua pontuação foi',
        'congrats': 'Parabéns! Você já pode escrever.',
        'try_again': 'Tentar Novamente',
        'new_story': 'Informações da História',
        'write_content': 'Escrever Conteúdo',
        'highlight_vocab': 'Destacar Vocabulário',
        'publish': 'PUBLICAR',
        'next': 'PRÓXIMO',
        'title': 'Título',
        'enter_title': 'Digite o título...',
        'subtitle': 'Subtítulo',
        'short_desc': 'Breve descrição...',
        'category': 'Categoria',
        'select_cat': 'Selecione a Categoria',
        'select_level': 'Selecione o Nível',
        'add_cover': 'Adicionar Capa',
        'add_audio': 'Adicionar Áudio',
        'optional': '(Opcional)',
        'start_writing': 'Comece a escrever aqui...',
        'tap_highlight': 'Toque numa palavra para selecionar, depois escolha uma cor abaixo.',
        'clear': 'Limpar',
        'link_copied': 'Link copiado!'
    },
    'Japanese': {
        'username_q': 'お名前を教えてください',
        'username_ph': 'ユーザー名を入力',
        'native_q': '母語は何ですか？',
        'target_q': '何を学びたいですか？',
        'level_q': '現在のレベルは？',
        'interests_q': '興味のあるトピックは？',
        'pick_3': '3つ以上選んでください。',
        'continue': '次へ',
        'get_started': '始める',
        'daily_goal': '毎日の目標',
        'write_story': '物語を書く...',
        'explore': '探す',
        'saved': '保存済み',
        'profile': 'プロフィール',
        'settings': '設定',
        'logout': 'ログアウト',
        'reminders': 'リマインダー',
        'reminders_time': '通知時間',
        'email_notif': 'メール通知',
        'reminders_desc': '学習時間を設定します。',
        'level_label': 'レベル',
        'dark_mode': 'ダークモード',
        'app_lang': 'アプリの言語',
        'share': 'シェアする',
        'no_articles': '記事が見つかりません。',
        'be_first': '最初の記事を書きましょう！',
        'search_ph': '記事や著者を検索...',
        'writer_status': '作家ステータス',
        'verified': '認証済み作家',
        'take_test': '能力テストを受ける',
        'streak': 'ストリーク',
        'you': 'あなた',
        'learning': '学習中',
        'days': '日',
        'choose_lang': '言語を選択',
        'passed': '合格！',
        'failed': '不合格',
        'score': 'スコア:',
        'congrats': 'おめでとうございます！',
        'try_again': 'もう一度',
        'new_story': '新しい物語',
        'write_content': '本文を書く',
        'highlight_vocab': '単語をハイライト',
        'publish': '公開',
        'next': '次へ',
        'title': 'タイトル',
        'enter_title': 'タイトルを入力...',
        'subtitle': 'サブタイトル',
        'short_desc': '短い説明...',
        'category': 'カテゴリー',
        'select_cat': 'カテゴリーを選択',
        'select_level': 'レベルを選択',
        'add_cover': '表紙画像',
        'add_audio': '音声を追加',
        'optional': '(任意)',
        'start_writing': 'ここに物語を書いてください...',
        'tap_highlight': '単語をタップして選択し、下の色を選んでハイライトします。',
        'clear': 'クリア',
        'link_copied': 'リンクをコピーしました'
    },
    'Spanish': {
        'username_q': '¿Cómo te llamas?',
        'username_ph': 'Ingresa tu nombre de usuario',
        'native_q': '¿Cuál es tu idioma nativo?',
        'target_q': '¿Qué quieres aprender?',
        'level_q': '¿Cuál es tu nivel actual?',
        'interests_q': '¿Cuáles son tus intereses?',
        'pick_3': 'Elige al menos 3 temas.',
        'continue': 'Continuar',
        'get_started': 'Comenzar',
        'daily_goal': 'Meta Diaria',
        'write_story': 'Escribir historia...',
        'explore': 'Explorar',
        'saved': 'Guardados',
        'profile': 'Perfil',
        'settings': 'Ajustes',
        'logout': 'Cerrar Sesión',
        'reminders': 'Recordatorios',
        'reminders_time': 'Hora de Notificación',
        'email_notif': 'Notificaciones por Correo',
        'reminders_desc': 'Configura tu hora de estudio.',
        'level_label': 'Nivel',
        'dark_mode': 'Modo Oscuro',
        'app_lang': 'Idioma de la App',
        'share': 'Compartir',
        'no_articles': 'No se encontraron artículos.',
        'be_first': '¡Sé el primero en escribir!',
        'search_ph': 'Buscar artículos...',
        'writer_status': 'Estado de Escritor',
        'verified': 'Escritor Verificado',
        'take_test': 'Tomar Prueba',
        'streak': 'Racha',
        'you': 'Tú',
        'learning': 'Aprendiendo',
        'days': 'días',
        'choose_lang': 'Elegir Idioma',
        'passed': '¡Desbloqueado!',
        'failed': 'Prueba Fallida',
        'score': 'Tu puntaje:',
        'congrats': '¡Felicidades!',
        'try_again': 'Intentar de nuevo',
        'new_story': 'Nueva Historia',
        'write_content': 'Escribir Contenido',
        'highlight_vocab': 'Resaltar Vocabulario',
        'publish': 'PUBLICAR',
        'next': 'SIGUIENTE',
        'title': 'Título',
        'enter_title': 'Ingresa el título...',
        'subtitle': 'Subtítulo',
        'short_desc': 'Breve descripción...',
        'category': 'Categoría',
        'select_cat': 'Seleccionar Categoría',
        'select_level': 'Seleccionar Nivel',
        'add_cover': 'Añadir Portada',
        'add_audio': 'Añadir Audio',
        'optional': '(Opcional)',
        'start_writing': 'Empieza a escribir aquí...',
        'tap_highlight': 'Toca una palabra y selecciona un color abajo.',
        'clear': 'Limpiar',
        'link_copied': '¡Enlace copiado!'
    },
    'French': {
        'username_q': 'Comment vous appelez-vous ?',
        'username_ph': 'Entrez votre nom d\'utilisateur',
        'native_q': 'Quelle est votre langue maternelle ?',
        'target_q': 'Que voulez-vous apprendre ?',
        'level_q': 'Quel est votre niveau ?',
        'interests_q': 'Vos centres d\'intérêt ?',
        'pick_3': 'Choisissez au moins 3 sujets.',
        'continue': 'Continuer',
        'get_started': 'Commencer',
        'daily_goal': 'Objectif Quotidien',
        'write_story': 'Écrire une histoire...',
        'explore': 'Explorer',
        'saved': 'Sauvegardés',
        'profile': 'Profil',
        'settings': 'Paramètres',
        'logout': 'Déconnexion',
        'reminders': 'Rappels',
        'reminders_time': 'Heure de Notification',
        'email_notif': 'Notifications par Email',
        'reminders_desc': 'Définissez votre heure d\'étude.',
        'level_label': 'Niveau',
        'dark_mode': 'Mode Sombre',
        'app_lang': 'Langue de l\'App',
        'share': 'Partager',
        'no_articles': 'Aucun article trouvé.',
        'be_first': 'Soyez le premier à écrire !',
        'search_ph': 'Rechercher...',
        'writer_status': 'Statut d\'Écrivain',
        'verified': 'Écrivain Vérifié',
        'take_test': 'Passer le Test',
        'streak': 'Série',
        'you': 'Vous',
        'learning': 'Apprentissage',
        'days': 'jours',
        'choose_lang': 'Choisir la Langue',
        'passed': 'Débloqué !',
        'failed': 'Échec du Test',
        'score': 'Votre score :',
        'congrats': 'Félicitations !',
        'try_again': 'Réessayer',
        'new_story': 'Nouvelle Histoire',
        'write_content': 'Contenu',
        'highlight_vocab': 'Surligner',
        'publish': 'PUBLIER',
        'next': 'SUIVANT',
        'title': 'Titre',
        'enter_title': 'Entrez le titre...',
        'subtitle': 'Sous-titre',
        'short_desc': 'Brève description...',
        'category': 'Catégorie',
        'select_cat': 'Choisir Catégorie',
        'select_level': 'Choisir Niveau',
        'add_cover': 'Ajouter Couverture',
        'add_audio': 'Ajouter Audio',
        'optional': '(Optionnel)',
        'start_writing': 'Commencez à écrire ici...',
        'tap_highlight': 'Tapez un mot puis choisissez une couleur.',
        'clear': 'Effacer',
        'link_copied': 'Lien copié !'
    }
};

const getTranslation = (lang: string, key: string): string => {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS['English'];
    return dict[key] || TRANSLATIONS['English'][key] || key;
};

// --- DATA: REAL QUESTIONS & MOCKS ---

const QUIZ_DATA: Record<string, Question[]> = {
    'Japanese': [
        { type: 'Vocabulary', q: 'What is "Thank you" in Japanese?', options: ['Arigatou', 'Sayonara', 'Konnichiwa', 'Sumimasen'], correctString: 'Arigatou' },
        { type: 'Grammar', q: 'Which particle indicates the subject?', options: ['Wa (は)', 'Wo (を)', 'De (で)', 'Ni (に)'], correctString: 'Wa (は)' },
    ],
    // Simplified for demo
    'English': [
         { type: 'Grammar', q: 'Select the correct verb: "She ___ to the store."', options: ['went', 'go', 'going', 'gone'], correctString: 'went' },
    ]
};

const DEMO_COMMENTS: Comment[] = [
  { 
    id: '1', user: 'Takeshi', avatar: 'https://ui-avatars.com/api/?name=Takeshi&background=0D8ABC&color=fff', 
    text: 'This was very helpful! I learned new vocabulary.', timeAgo: '10m', likes: 5, isLiked: false, 
    replies: [
        { id: '1-1', user: 'You', avatar: 'https://ui-avatars.com/api/?name=You&background=FF8C00&color=fff', text: 'Glad it helped! Which word was new for you?', timeAgo: '5m', likes: 1, isLiked: false, replies: [] }
    ]
  },
  { id: '2', user: 'Ana Silva', avatar: 'https://ui-avatars.com/api/?name=Ana&background=E91E63&color=fff', text: 'Could you explain the grammar in the second paragraph?', timeAgo: '1h', likes: 2, isLiked: false, replies: [] },
];

const INITIAL_ARTICLES: Article[] = [
  {
    id: 'jp-1', title: '稲荷神社と狐の秘密', subtitle: 'The Secret of Inari Shrines and Foxes', author: 'Sakura Writes',
    authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=100&auto=format&fit=crop',
    timeAgo: '2h ago', level: 'N4', tags: ['Culture', 'Folklore'],
    imageUrl: 'https://images.unsplash.com/photo-1478436127897-769e1b3f0f36?q=80&w=2070&auto=format&fit=crop',
    languageCode: 'ja-JP', languageName: 'Japanese',
    content: `日本にはたくさんの神社があります。その中で、一番多いのが「稲荷神社（いなりじんじゃ）」です。\n\n稲荷神社の入り口には、犬ではなく、狐（きつね）の像があります。どうしてでしょうか？昔の人は、狐が神様のメッセージを運ぶ動物だと信じていました。\n\n狐は春になると山から下りてきて、秋になると山へ帰ります。これが、お米を作る時期と同じだったからです。`
  },
  {
    id: 'en-1', title: 'The Future of Space Travel', subtitle: 'Mars colonization might be closer than we think', author: 'John Smith',
    authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=100&auto=format&fit=crop',
    timeAgo: '1h ago', level: 'B1', tags: ['Science', 'Technology'],
    imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop',
    languageCode: 'en-US', languageName: 'English',
    content: `Space travel has always fascinated humanity. For decades, we have dreamed of walking on other planets. Today, that dream is becoming a reality faster than many expected.\n\nCompanies like SpaceX are building massive rockets designed to carry humans to Mars.`
  },
];

const generateRealQuestions = (language: string) => {
  const baseQuestions = QUIZ_DATA[language] || QUIZ_DATA['English'];
  const fullQuiz = [];
  for(let i=0; i<10; i++) {
      fullQuiz.push(...baseQuestions);
  }
  return fullQuiz.slice(0, 20).map((q, i) => ({
      ...q,
      q: `${q.q} (${i + 1}/20)` 
  }));
};

// --- COMPONENTS ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, fullWidth = false }: any) => {
  const base = "font-semibold rounded-xl transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2";
  const sizes = "py-3.5 px-6 text-[15px]";
  const width = fullWidth ? "w-full" : "";
  
  const variants = {
    primary: "bg-brand text-white shadow-brand/20 shadow-lg hover:bg-brand-dark hover:shadow-brand/30 disabled:opacity-50 disabled:shadow-none",
    secondary: "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-2 border-slate-200 dark:border-slate-700 hover:border-brand dark:hover:border-brand hover:text-brand dark:hover:text-brand",
    ghost: "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
  };

  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${sizes} ${width} ${variants[variant as keyof typeof variants]} ${className}`}>
      {children}
    </button>
  );
};

const SelectionCard = ({ selected, onClick, children, className = '', disabled = false }: any) => (
  <div 
    onClick={!disabled ? onClick : undefined}
    className={`
      rounded-2xl border-2 p-4 transition-all duration-200 flex items-center gap-3 relative overflow-hidden
      ${disabled ? 'opacity-50 cursor-not-allowed border-slate-100 bg-slate-50 dark:bg-slate-900 dark:border-slate-800' : 'cursor-pointer'}
      ${selected && !disabled
        ? 'border-brand bg-brand-50 dark:bg-brand-900/10 shadow-sm' 
        : !disabled ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600' : ''
      }
      ${className}
    `}
  >
    {children}
    {selected && (
      <div className="absolute top-2 right-2 text-brand">
        <div className="bg-brand rounded-full p-0.5">
          <Check size={12} className="text-white" />
        </div>
      </div>
    )}
  </div>
);

// --- AUTH VIEW COMPONENT ---
const AuthView = ({ onAuthSuccess }: { onAuthSuccess: () => void }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAuth = async () => {
        setLoading(true);
        setError('');
        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                // Auto login after sign up if possible, or just continue
            }
            onAuthSuccess();
        } catch (e: any) {
            setError(e.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white dark:bg-[#0f1115]">
            <div className="w-full max-w-sm space-y-6 animate-fade-in">
                <div className="text-center mb-8">
                    {/* APP ICON REPLACEMENT */}
                    <img src={APP_ICON_URL} alt="WenLang Logo" className="w-24 h-24 rounded-3xl mx-auto mb-6 shadow-xl shadow-brand/20" />
                    
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
                    <p className="text-slate-500">WenLang - Language Learning</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Email</label>
                        <input 
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-brand outline-none text-slate-900 dark:text-white"
                            placeholder="hello@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Password</label>
                        <input 
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-brand outline-none text-slate-900 dark:text-white"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl flex items-center gap-2">
                        <AlertCircle size={16} /> {error}
                    </div>
                )}

                <Button fullWidth onClick={handleAuth} disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : (isLogin ? 'Login' : 'Sign Up')}
                </Button>

                <div className="text-center mt-4">
                    <button onClick={() => setIsLogin(!isLogin)} className="text-sm font-bold text-brand hover:underline">
                        {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
                    </button>
                </div>
            </div>
        </div>
    );
};

const CommentsSection = ({ comments, onUpdateComments }: { comments: Comment[], onUpdateComments: (newComments: Comment[]) => void }) => {
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const handleLike = (commentId: string) => {
    const updateLikes = (list: Comment[]): Comment[] => {
      return list.map(c => {
        if (c.id === commentId) {
          return { ...c, likes: c.isLiked ? c.likes - 1 : c.likes + 1, isLiked: !c.isLiked };
        }
        if (c.replies) {
          return { ...c, replies: updateLikes(c.replies) };
        }
        return c;
      });
    };
    onUpdateComments(updateLikes(comments));
  };

  const handleReplySubmit = (parentId: string) => {
    if(!replyText.trim()) return;
    const newReply: Comment = {
      id: Date.now().toString(),
      user: 'You',
      avatar: 'https://ui-avatars.com/api/?name=You&background=FF8C00&color=fff',
      text: replyText,
      timeAgo: 'Just now',
      likes: 0,
      isLiked: false
    };

    const addReply = (list: Comment[]): Comment[] => {
        return list.map(c => {
            if (c.id === parentId) {
                return { ...c, replies: [...(c.replies || []), newReply] };
            }
            if (c.replies) {
                return { ...c, replies: addReply(c.replies) };
            }
            return c;
        });
    };
    onUpdateComments(addReply(comments));
    setReplyText('');
    setReplyingTo(null);
  };

  // Recursive render
  const renderComment = (comment: Comment, depth = 0) => (
    <div key={comment.id} className={`${depth > 0 ? 'ml-12 mt-4 border-l-2 border-slate-100 dark:border-slate-800 pl-4' : 'mb-6'}`}>
       <div className="flex items-start gap-3">
          <img src={comment.avatar} className="w-8 h-8 rounded-full" />
          <div className="flex-1">
             <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl rounded-tl-none">
                <div className="flex items-center justify-between mb-1">
                   <span className="font-bold text-sm text-slate-900 dark:text-white">{comment.user}</span>
                   <span className="text-xs text-slate-400">{comment.timeAgo}</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">{comment.text}</p>
             </div>
             <div className="flex items-center gap-4 mt-2 pl-2">
                <button onClick={() => handleLike(comment.id)} className={`text-xs font-bold flex items-center gap-1 ${comment.isLiked ? 'text-red-500' : 'text-slate-400'}`}>
                   <Heart size={14} className={comment.isLiked ? 'fill-current' : ''}/> {comment.likes}
                </button>
                <button onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)} className="text-xs font-bold text-slate-400 flex items-center gap-1 hover:text-brand">
                   Reply
                </button>
             </div>
             {replyingTo === comment.id && (
                 <div className="mt-3 flex gap-2 animate-fade-in">
                    <input 
                      value={replyText} 
                      onChange={e => setReplyText(e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand"
                      placeholder="Write a reply..."
                      autoFocus
                    />
                    <button onClick={() => handleReplySubmit(comment.id)} className="p-2 bg-brand text-white rounded-xl"><Send size={16} /></button>
                 </div>
             )}
          </div>
       </div>
       {comment.replies && comment.replies.map(r => renderComment(r, depth + 1))}
    </div>
  );

  return (
     <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 pb-24">
       <h3 className="text-xl font-bold mb-6 text-slate-900 dark:text-white flex items-center gap-2">
         <MessageSquare size={20} /> Discussion <span className="text-sm font-normal text-slate-400">({comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)})</span>
       </h3>
       {comments.map(c => renderComment(c))}
     </div>
  );
};

// --- QUIZ VIEW ---

const QuizView = ({ language, onClose, onPass, t }: any) => {
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);

  useEffect(() => {
    setQuestions(generateRealQuestions(language));
  }, [language]);

  const handleAnswer = (selectedOption: string) => {
    if (selectedOption === questions[currentQ].correctString) {
        setScore(s => s + 1);
    }
    if (currentQ < questions.length - 1) {
      setCurrentQ(q => q + 1);
    } else {
      setFinished(true);
    }
  };

  const passed = score >= 18; 

  if (finished) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-[#0f1115] flex flex-col items-center justify-center p-6 animate-fade-in">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
          {passed ? <CheckCircle size={40} /> : <X size={40} />}
        </div>
        <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">
          {passed ? `${language} ${t('passed')}` : t('failed')}
        </h2>
        <p className="text-center text-slate-500 mb-8 max-w-xs">
          {passed ? t('congrats') : `${t('score')} ${score}/20.`}
        </p>
        <Button onClick={() => { if (passed) onPass(); onClose(); }}>
          {passed ? t('continue') : t('try_again')}
        </Button>
      </div>
    );
  }

  if (questions.length === 0) return <div>Loading...</div>;

  const q = questions[currentQ];

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-[#0f1115] flex flex-col animate-slide-up">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <button onClick={onClose}><X size={24} className="text-slate-400" /></button>
        <div className="flex flex-col items-center">
            <span className="font-bold text-slate-900 dark:text-white">{language} Proficiency</span>
            <span className="text-xs text-slate-500">{q.type} - Q{currentQ + 1}/20</span>
        </div>
        <div className="w-6" />
      </div>
      <div className="flex-1 p-6 flex flex-col justify-center max-w-md mx-auto w-full">
        <h3 className="text-xl font-bold mb-8 text-slate-900 dark:text-white leading-relaxed">{q.q}</h3>
        <div className="space-y-3">
          {q.options.map((opt: string, i: number) => (
            <button key={i} onClick={() => handleAnswer(opt)} className="w-full text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-all font-medium text-slate-700 dark:text-slate-200">
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// --- EDITOR VIEW (With Audio/Image Update) ---

const EditorView = ({ language, onClose, onPublish, t }: any) => {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [content, setContent] = useState('');
  const [level, setLevel] = useState('');
  const [category, setCategory] = useState('');
  const [words, setWords] = useState<{word: string, colorClass: string}[]>([]);
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);

  const langConfig = LANGUAGES.find(l => l.name === language);
  const levels = LEVEL_SYSTEMS[langConfig?.system || 'CEFR'];

  const handleContentNext = () => {
    const splitWords = content.split(' ').map(w => ({ word: w, colorClass: '' }));
    setWords(splitWords);
    setStep(3);
  };

  const applyColor = (colorClass: string) => {
    if (selectedWordIndex !== null) {
      const newWords = [...words];
      newWords[selectedWordIndex].colorClass = colorClass;
      setWords(newWords);
      setSelectedWordIndex(null);
    }
  };

  const handlePublish = () => {
    const newArticle: Article = {
      id: Date.now().toString(),
      title,
      subtitle,
      author: 'You',
      authorAvatar: 'https://ui-avatars.com/api/?name=You&background=FF8C00&color=fff',
      timeAgo: 'Just now',
      level: level || 'A1',
      tags: [category],
      imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?q=80&w=2073&auto=format&fit=crop',
      content: content,
      languageCode: langConfig?.tts || 'en-US',
      languageName: language
    };
    onPublish(newArticle);
  };

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-[#0f1115] flex flex-col animate-slide-up">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button onClick={step === 1 ? onClose : () => setStep(s => s - 1)} className="p-2 -ml-2 text-slate-500"><ChevronLeft /></button>
            <span className="font-bold text-slate-900 dark:text-white">
                {step === 1 ? t('new_story') : step === 2 ? t('write_content') : t('highlight_vocab')}
            </span>
            <button onClick={step === 3 ? handlePublish : step === 2 ? handleContentNext : () => setStep(2)} disabled={step === 1 && (!title || !level || !category)} className="text-brand font-bold text-sm disabled:opacity-50">
                {step === 3 ? t('publish') : t('next')}
            </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
            {step === 1 && (
                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Language</label>
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-white flex items-center gap-2"><span>{langConfig?.flag}</span> {language}</div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{t('title')}</label>
                        <input value={title} onChange={e => setTitle(e.target.value)} className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-brand outline-none text-slate-900 dark:text-white font-bold text-lg" placeholder={t('enter_title')} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{t('subtitle')}</label>
                        <input value={subtitle} onChange={e => setSubtitle(e.target.value)} className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-brand outline-none text-slate-900 dark:text-white" placeholder={t('short_desc')} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{t('level_label')}</label>
                            <select value={level} onChange={e => setLevel(e.target.value)} className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-brand outline-none text-slate-900 dark:text-white appearance-none">
                                <option value="">{t('select_level')}</option>
                                {levels.map(l => <option key={l.id} value={l.id}>{l.id} - {l.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-2">{t('category')}</label>
                            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-brand outline-none text-slate-900 dark:text-white appearance-none">
                                <option value="">{t('select_cat')}</option>
                                {HOBBY_CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                    
                    {/* --- ADDED AUDIO AND COVER IMAGE SELECTION --- */}
                    <div className="grid grid-cols-2 gap-4">
                         <div className="p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center text-slate-400 gap-2 cursor-pointer hover:border-brand hover:text-brand transition-colors group">
                            <ImageIcon size={24} />
                            <span className="text-xs font-medium text-center">{t('add_cover')}<br/>{t('optional')}</span>
                            <input type="file" accept="image/*" className="hidden" />
                        </div>
                        <div className="p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center text-slate-400 gap-2 cursor-pointer hover:border-brand hover:text-brand transition-colors group">
                            <Music size={24} />
                            <span className="text-xs font-medium text-center">{t('add_audio')}<br/>{t('optional')}</span>
                            <input type="file" accept="audio/*" className="hidden" />
                        </div>
                    </div>
                </div>
            )}
            {step === 2 && (
                <div className="h-full flex flex-col">
                    <textarea value={content} onChange={e => setContent(e.target.value)} className="flex-1 w-full p-4 rounded-xl bg-transparent border-none focus:ring-0 outline-none text-slate-900 dark:text-white text-lg leading-relaxed resize-none" placeholder={t('start_writing')} />
                </div>
            )}
            {step === 3 && (
                <div>
                     <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl text-sm flex items-start gap-3">
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <p>{t('tap_highlight')}</p>
                     </div>
                     <div className="leading-[2.5] text-xl font-jp text-slate-800 dark:text-slate-300">
                        {words.map((w, i) => (
                            <span key={i} onClick={() => setSelectedWordIndex(i)} className={`cursor-pointer rounded px-1 py-0.5 mx-0.5 transition-all ${w.colorClass} ${selectedWordIndex === i ? 'ring-2 ring-slate-900 dark:ring-white' : ''} hover:bg-slate-100 dark:hover:bg-slate-800`}>{w.word}</span>
                        ))}
                     </div>
                     <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-[#0f1115] border-t border-slate-200 dark:border-slate-800 flex gap-2 overflow-x-auto no-scrollbar justify-center z-50">
                        {levels.map(l => (
                            <button key={l.id} onClick={() => applyColor(`${l.color}`)} className={`flex flex-col items-center gap-1 p-2 rounded-lg min-w-[60px] ${selectedWordIndex === null ? 'opacity-50' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`} disabled={selectedWordIndex === null}>
                                <div className={`w-6 h-6 rounded-full border-2 ${l.ring.replace('text', 'border')} ${l.color}`}></div><span className="text-[10px] font-bold text-slate-500">{l.id}</span>
                            </button>
                        ))}
                        <button onClick={() => applyColor('')} className={`flex flex-col items-center gap-1 p-2 rounded-lg min-w-[60px] ${selectedWordIndex === null ? 'opacity-50' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`} disabled={selectedWordIndex === null}>
                             <div className="w-6 h-6 rounded-full border-2 border-slate-300 bg-transparent flex items-center justify-center"><X size={12} /></div><span className="text-[10px] font-bold text-slate-500">{t('clear')}</span>
                        </button>
                     </div>
                </div>
            )}
        </div>
    </div>
  );
};

// --- LANGUAGE PICKER MODAL ---

const LanguagePickerModal = ({ unlockedSet, onClose, onSelect, t }: any) => {
    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-slide-up">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('choose_lang')}</h3>
                    <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full"><X size={18} /></button>
                </div>
                <div className="space-y-3">
                    {LANGUAGES.map(lang => {
                        const isUnlocked = unlockedSet.has(lang.name);
                        return (
                            <button
                                key={lang.name}
                                onClick={() => onSelect(lang.name, !isUnlocked)}
                                className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${isUnlocked ? 'border-brand bg-brand-50 dark:bg-brand-900/10' : 'border-slate-100 dark:border-slate-800 opacity-60'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{lang.flag}</span>
                                    <span className="font-bold text-slate-900 dark:text-white">{lang.name}</span>
                                </div>
                                {isUnlocked ? <PenTool size={18} className="text-brand" /> : <Lock size={18} className="text-slate-400" />}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// --- USERNAME SETUP COMPONENT ---
const UsernameSetup = ({ onNext }: { onNext: (username: string) => void }) => {
    const [username, setUsername] = useState('');
    // Use english as default here since we don't have a profile yet, or user could select lang first.
    // Keeping it simple with English labels for this specific step as per constraints.
    
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white dark:bg-[#0f1115]">
            <div className="w-full max-w-md space-y-8 animate-fade-in">
                <h1 className="text-3xl font-bold text-center dark:text-white">What should we call you?</h1>
                <div>
                     <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Username</label>
                     <input 
                        value={username} 
                        onChange={e => setUsername(e.target.value)}
                        className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-brand outline-none text-slate-900 dark:text-white text-lg font-bold"
                        placeholder="e.g. Polyglot123"
                        autoFocus
                    />
                </div>
                <Button fullWidth onClick={() => onNext(username)} disabled={!username.trim()}>
                    Continue
                </Button>
            </div>
        </div>
    );
};

// --- ONBOARDING COMPONENT ---
const Onboarding = ({ onComplete }: { onComplete: (p: UserProfile, l: string) => void }) => {
  const [step, setStep] = useState(0);
  const [native, setNative] = useState('English');
  const [target, setTarget] = useState('Japanese');
  const [level, setLevel] = useState('N5');
  const [hobbies, setHobbies] = useState<string[]>([]);

  const next = () => setStep(s => s + 1);
  const t = (k: string) => getTranslation(native, k);

  const handleFinish = () => {
      onComplete({
          username: '', // This will be merged in the App component
          nativeLanguage: native,
          targetLanguage: target,
          level: level,
          hobbies: hobbies,
          emailNotifications: false, // Default
          reminderTime: '09:00' // Default
      }, native);
  };

  return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white dark:bg-[#0f1115]">
          <div className="w-full max-w-md space-y-8 animate-fade-in">
              {step === 0 && (
                  <>
                      <h1 className="text-3xl font-bold text-center dark:text-white">{t('native_q')}</h1>
                      <div className="grid grid-cols-2 gap-3">
                          {LANGUAGES.map(l => (
                              <SelectionCard key={l.code} selected={native === l.name} onClick={() => setNative(l.name)}>
                                  <span className="text-2xl">{l.flag}</span>
                                  <span className="font-bold">{l.name}</span>
                              </SelectionCard>
                          ))}
                      </div>
                  </>
              )}
              {step === 1 && (
                  <>
                      <h1 className="text-3xl font-bold text-center dark:text-white">{t('target_q')}</h1>
                      <div className="grid grid-cols-2 gap-3">
                          {LANGUAGES.filter(l => l.name !== native).map(l => (
                              <SelectionCard key={l.code} selected={target === l.name} onClick={() => setTarget(l.name)}>
                                  <span className="text-2xl">{l.flag}</span>
                                  <span className="font-bold">{l.name}</span>
                              </SelectionCard>
                          ))}
                      </div>
                  </>
              )}
              {step === 2 && (
                   <>
                      <h1 className="text-3xl font-bold text-center dark:text-white">{t('level_q')}</h1>
                      <div className="space-y-3">
                          {LEVEL_SYSTEMS[LANGUAGES.find(l => l.name === target)?.system || 'CEFR'].map(l => (
                               <SelectionCard key={l.id} selected={level === l.id} onClick={() => setLevel(l.id)}>
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${l.color}`}>{l.id}</div>
                                  <div className="flex-1 text-left">
                                      <div className="font-bold dark:text-white">{l.label}</div>
                                      <div className="text-xs text-slate-400">{l.sub}</div>
                                  </div>
                               </SelectionCard>
                          ))}
                      </div>
                   </>
              )}
              {step === 3 && (
                   <>
                      <h1 className="text-3xl font-bold text-center dark:text-white">{t('interests_q')}</h1>
                      <p className="text-center text-slate-500">{t('pick_3')}</p>
                      <div className="grid grid-cols-2 gap-3">
                          {HOBBY_CATEGORIES.flatMap(c => c.subcategories.map(s => ({ cat: c, sub: s }))).map((item, i) => (
                               <SelectionCard key={i} selected={hobbies.includes(item.sub)} onClick={() => {
                                   if (hobbies.includes(item.sub)) setHobbies(hobbies.filter(x => x !== item.sub));
                                   else setHobbies([...hobbies, item.sub]);
                               }}>
                                  <span className="text-xl">{item.cat.icon}</span>
                                  <span className="font-bold text-sm dark:text-white">{item.sub}</span>
                               </SelectionCard>
                          ))}
                      </div>
                   </>
              )}

              <Button fullWidth onClick={step === 3 ? handleFinish : next} disabled={step === 3 && hobbies.length < 3}>
                  {step === 3 ? t('get_started') : t('continue')}
              </Button>
          </div>
      </div>
  );
};

// --- SETTINGS VIEW ---
const SettingsView = ({ profile, onClose, darkMode, setDarkMode, appLanguage, setAppLanguage }: any) => {
    // Initialize state from profile
    const [reminderTime, setReminderTime] = useState(profile?.reminderTime || '09:00');
    const [emailNotif, setEmailNotif] = useState(profile?.emailNotifications || false);

    const t = (k: string) => getTranslation(appLanguage, k);

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'WenLang',
                    text: 'Join me on WenLang!',
                    url: window.location.href,
                });
            } catch (err) {
                console.error(err);
            }
        } else {
            // Fallback for PC
            try {
                await navigator.clipboard.writeText(window.location.href);
                alert(t('link_copied'));
            } catch (err) {
                alert("Could not copy link");
            }
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.reload(); 
    };

    // --- FUNCTIONAL UPDATES FOR SETTINGS ---
    const updateSettings = async (updates: any) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
             const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', session.user.id);
             if (error) console.error('Error updating settings:', error);
        }
    };

    const handleReminderTimeChange = (e: any) => {
        const newTime = e.target.value;
        setReminderTime(newTime);
        updateSettings({ reminderTime: newTime });
    };

    const handleEmailToggle = () => {
        const newState = !emailNotif;
        setEmailNotif(newState);
        updateSettings({ emailNotifications: newState });
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0f1115] animate-slide-up">
            <div className="bg-white dark:bg-slate-900 px-6 py-4 sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
                 <button onClick={onClose}><ChevronLeft className="text-slate-500 dark:text-slate-400" /></button>
                 <h2 className="text-xl font-bold dark:text-white">{t('settings')}</h2>
            </div>
            <div className="p-6 space-y-6 max-w-md mx-auto">
                 <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden">
                     <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-700">
                         <div className="flex items-center gap-3">
                             <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg"><Moon size={20} className="text-slate-600 dark:text-slate-300"/></div>
                             <span className="font-medium dark:text-white">{t('dark_mode')}</span>
                         </div>
                         <button onClick={() => setDarkMode(!darkMode)} className={`w-12 h-7 rounded-full transition-colors relative ${darkMode ? 'bg-brand' : 'bg-slate-200'}`}>
                             <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all ${darkMode ? 'left-6' : 'left-1'}`} />
                         </button>
                     </div>
                     <div className="p-4 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                             <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg"><Globe size={20} className="text-slate-600 dark:text-slate-300"/></div>
                             <span className="font-medium dark:text-white">{t('app_lang')}</span>
                         </div>
                         <select value={appLanguage} onChange={e => setAppLanguage(e.target.value)} className="bg-transparent text-right font-bold text-brand outline-none">
                             {LANGUAGES.map(l => <option key={l.name} value={l.name}>{l.name}</option>)}
                         </select>
                     </div>
                 </div>

                 {/* Updated Reminders Section */}
                 <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden">
                     <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                         <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg"><Clock size={20} className="text-slate-600 dark:text-slate-300"/></div>
                                <div>
                                    <div className="font-medium dark:text-white">{t('reminders_time')}</div>
                                    <div className="text-xs text-slate-400">{t('reminders_desc')}</div>
                                </div>
                            </div>
                            <input 
                                type="time" 
                                value={reminderTime} 
                                onChange={handleReminderTimeChange}
                                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm font-bold text-slate-700 dark:text-slate-200 focus:border-brand outline-none"
                            />
                         </div>
                     </div>
                     <div className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg"><Mail size={20} className="text-slate-600 dark:text-slate-300"/></div>
                            <span className="font-medium dark:text-white">{t('email_notif')}</span>
                        </div>
                        <button onClick={handleEmailToggle} className={`w-12 h-7 rounded-full transition-colors relative ${emailNotif ? 'bg-brand' : 'bg-slate-200'}`}>
                             <div className={`w-5 h-5 bg-white rounded-full absolute top-1 transition-all ${emailNotif ? 'left-6' : 'left-1'}`} />
                         </button>
                     </div>
                 </div>
                 
                 <Button variant="ghost" fullWidth onClick={handleShare} className="text-brand hover:bg-brand-50 mb-2">
                    <Share2 size={18} className="mr-2" />
                    {t('share')}
                 </Button>

                 <Button variant="ghost" fullWidth onClick={handleLogout} className="text-red-500 hover:bg-red-50 hover:text-red-600">{t('logout')}</Button>
            </div>
        </div>
    )
}

// --- PROFILE VIEW ---
const ProfileView = ({ profile, isWriterUnlocked, onOpenLangPicker, onOpenSettings, t }: any) => {
    return (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold dark:text-white">{t('profile')}</h2>
                <button onClick={onOpenSettings}><Settings className="text-slate-400" /></button>
            </div>
            
            <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <div className="w-20 h-20 rounded-full bg-slate-200 overflow-hidden">
                     {/* Use profile username for avatar if available */}
                     <img src={`https://ui-avatars.com/api/?name=${profile?.username || 'User'}&background=0D8ABC&color=fff`} className="w-full h-full object-cover"/>
                </div>
                <div>
                    <h3 className="text-xl font-bold dark:text-white">{profile?.username || t('you')}</h3>
                    <p className="text-slate-500">{t('learning')} {profile?.targetLanguage}</p>
                    <div className="flex gap-2 mt-2">
                         <span className="px-2 py-1 bg-brand-100 text-brand-700 rounded text-xs font-bold">{profile?.level}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                 <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center gap-2">
                     <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><Sparkles size={20} /></div>
                     <span className="text-2xl font-bold dark:text-white">12</span>
                     <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{t('streak')}</span>
                 </div>
                 <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center gap-2">
                     <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><Clock size={20} /></div>
                     <span className="text-2xl font-bold dark:text-white">45</span>
                     <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{t('days')}</span>
                 </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 font-bold opacity-80"><PenTool size={16}/> {t('writer_status')}</div>
                        {isWriterUnlocked ? <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Check size={12}/> {t('verified')}</div> : <Lock size={16} className="opacity-50"/>}
                    </div>
                    <h3 className="text-2xl font-bold mb-2">{isWriterUnlocked ? 'Writer Access Unlocked' : 'Unlock Writer Access'}</h3>
                    <p className="text-indigo-100 text-sm mb-6 max-w-xs">{isWriterUnlocked ? 'You can now publish stories to the community in your target language.' : `Pass the ${profile?.targetLanguage} proficiency test to start writing stories.`}</p>
                    <Button onClick={onOpenLangPicker} variant="secondary" className="bg-white text-indigo-600 border-none hover:bg-indigo-50">
                        {isWriterUnlocked ? t('write_content') : t('take_test')}
                    </Button>
                </div>
            </div>
        </div>
    )
}

// --- READER COMPONENT ---
const Reader = ({ article, onClose, comments, onUpdateComments, isSaved, onToggleSave }: any) => {
    // Basic reader implementation
    const [fontSize, setFontSize] = useState(18);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { content, title, subtitle, imageUrl, author, timeAgo, level, languageCode } = article;
    
    // Very basic text-to-speech
    const handlePlay = () => {
        const u = new SpeechSynthesisUtterance(content);
        u.lang = languageCode;
        window.speechSynthesis.speak(u);
    };

    return (
        <div className="fixed inset-0 bg-white dark:bg-[#0f1115] z-50 flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-[#0f1115]/80 backdrop-blur z-10">
                 <button onClick={onClose}><ChevronLeft className="text-slate-600 dark:text-slate-300" /></button>
                 <div className="flex items-center gap-4">
                     <button onClick={handlePlay}><Headphones className="text-slate-600 dark:text-slate-300" /></button>
                     <button onClick={() => setFontSize(s => s === 18 ? 22 : 18)}><Type className="text-slate-600 dark:text-slate-300" /></button>
                     <button onClick={onToggleSave}>{isSaved ? <Bookmark className="fill-brand text-brand" /> : <Bookmark className="text-slate-600 dark:text-slate-300" />}</button>
                 </div>
            </div>
            <div className="flex-1 overflow-y-auto" ref={scrollRef}>
                 <div className="h-64 w-full relative">
                     <img src={imageUrl} className="w-full h-full object-cover" />
                     <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                         <div>
                             <span className="bg-brand text-white px-2 py-1 rounded text-xs font-bold mb-2 inline-block">{level}</span>
                             <h1 className="text-2xl font-bold text-white leading-tight mb-1">{title}</h1>
                             <p className="text-white/80 text-sm">{subtitle}</p>
                         </div>
                     </div>
                 </div>
                 <div className="p-6 max-w-2xl mx-auto">
                     <div className="flex items-center justify-between mb-8 text-sm text-slate-500">
                         <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                            <div className="w-8 h-8 bg-slate-200 rounded-full overflow-hidden"><img src={article.authorAvatar} /></div>
                            {author}
                         </div>
                         <span>{timeAgo}</span>
                     </div>
                     <div className={`prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 leading-loose whitespace-pre-wrap font-serif`} style={{ fontSize: `${fontSize}px` }}>
                         {content}
                     </div>
                     
                     <CommentsSection comments={comments} onUpdateComments={onUpdateComments} />
                 </div>
            </div>
        </div>
    );
};

// --- APP COMPONENT ---

const App = () => {
  const [view, setView] = useState<ViewState>('auth'); // Default to Auth
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<TabState>('home');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [appLanguage, setAppLanguage] = useState('English'); // Global App Language
  const [savedArticleIds, setSavedArticleIds] = useState<Set<string>>(new Set());
  const [unlockedLanguages, setUnlockedLanguages] = useState<Set<string>>(new Set());
  const [articles, setArticles] = useState<Article[]>(INITIAL_ARTICLES);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [selectedLangForQuiz, setSelectedLangForQuiz] = useState<string>('');
  const [selectedLangForEditor, setSelectedLangForEditor] = useState<string>('');
  const [currentReaderId, setCurrentReaderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(''); // New search state
  const [currentComments, setCurrentComments] = useState<Comment[]>(DEMO_COMMENTS);
  const [loadingSession, setLoadingSession] = useState(true);
  const [tempUsername, setTempUsername] = useState('');

  // Helper for translations in main App
  const t = (key: string) => getTranslation(appLanguage, key);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Check Supabase Session
  useEffect(() => {
      const checkSession = async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
              // Try to fetch profile
              const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
              
              if (data) {
                  setUserProfile(data);
                  setAppLanguage(data.nativeLanguage);
                  setView('home');
              } else {
                  // Session exists but no profile.
                  // Move to Username Setup instead of direct Onboarding
                  setView('username_setup');
              }
          } else {
              setView('auth');
          }
          setLoadingSession(false);
      };
      checkSession();
  }, []);

  const handleAuthSuccess = async () => {
      // Re-check profile after auth
      setLoadingSession(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
          const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
          if (data) {
              setUserProfile(data);
              setAppLanguage(data.nativeLanguage);
              setView('home');
          } else {
              setView('username_setup'); // Go to username setup first
          }
      }
      setLoadingSession(false);
  };

  const handleUsernameSubmit = (username: string) => {
      setTempUsername(username);
      setView('onboarding');
  };

  const handleOnboardingComplete = async (profileData: UserProfile, lang: string) => {
    // Save to Supabase
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        // Merge the username from the previous step
        const newProfile = { 
            ...profileData, 
            username: tempUsername, 
            id: session.user.id,
            emailNotifications: false, 
            reminderTime: '09:00'
        };

        const { error } = await supabase.from('profiles').upsert(newProfile);
        if (!error) {
            setUserProfile(newProfile);
            setAppLanguage(lang);
            setView('home');
        } else {
            console.error('Error saving profile:', error);
            // Fallback for demo if table doesn't exist
            setUserProfile(newProfile);
            setAppLanguage(lang);
            setView('home');
        }
    }
  };
  
  const handlePublish = (newArticle: Article) => {
    setArticles([newArticle, ...articles]);
    setView('home');
    alert(t('congrats'));
  };

  const handleToggleSave = (id: string) => {
    const newSaved = new Set(savedArticleIds);
    if (newSaved.has(id)) {
        newSaved.delete(id);
    } else {
        newSaved.add(id);
    }
    setSavedArticleIds(newSaved);
  };

  // FEED FILTER LOGIC: Match language AND Level
  const feedArticles = articles.filter(a => {
      // Default fallback for demo if profile isn't fully set
      if(!userProfile) return true;
      const matchLang = a.languageName === userProfile?.targetLanguage;
      const matchLevel = userProfile?.level === a.level;
      return matchLang && matchLevel;
  });

  // EXPLORE FILTER LOGIC
  const exploreArticles = articles.filter(a => {
      if (!searchQuery) return false;
      const q = searchQuery.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.author.toLowerCase().includes(q);
  });

  if (loadingSession) return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0f1115]">
          <Loader2 className="animate-spin text-brand" size={40} />
      </div>
  );

  if (view === 'auth') return <AuthView onAuthSuccess={handleAuthSuccess} />;

  if (view === 'username_setup') return <UsernameSetup onNext={handleUsernameSubmit} />;

  if (view === 'onboarding') return <Onboarding onComplete={handleOnboardingComplete} />;
  
  if (view === 'quiz') return <QuizView language={selectedLangForQuiz} onClose={() => setView('home')} onPass={() => {
    const newUnlocked = new Set(unlockedLanguages);
    newUnlocked.add(selectedLangForQuiz);
    setUnlockedLanguages(newUnlocked);
    setView('home');
  }} t={t} />;

  if (view === 'editor') return <EditorView language={selectedLangForEditor} onClose={() => setView('home')} onPublish={handlePublish} t={t} />;

  if (view === 'settings') return (
    <SettingsView 
        profile={userProfile} 
        setProfile={setUserProfile} 
        onClose={() => setView('home')} 
        darkMode={darkMode} 
        setDarkMode={setDarkMode}
        appLanguage={appLanguage}
        setAppLanguage={setAppLanguage}
    />
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f1115] transition-colors">
      {view === 'home' && (
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#0f1115]/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50">
          <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* UPDATED HEADER ICON: Replaced 'W' div with the custom App Icon */}
              <img src={APP_ICON_URL} alt="WenLang Logo" className="w-8 h-8 rounded-lg shadow-lg shadow-brand/20" />
              <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">WenLang</span>
            </div>
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 text-slate-400 hover:text-brand transition-colors">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>
      )}

      {view === 'home' && activeTab === 'home' && (
        <main className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-6 animate-fade-in">
           {/* Daily Goal */}
           <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{t('daily_goal')}</div>
                <div className="font-bold text-slate-900 dark:text-white flex items-baseline gap-1"><span className="text-2xl">12</span><span className="text-sm font-medium text-slate-500">/ 30 min</span></div>
              </div>
              <div className="w-16 h-16 relative flex items-center justify-center">
                 <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                   <path className="text-slate-100 dark:text-slate-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                   <path className="text-brand" strokeDasharray="40, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                 </svg>
              </div>
            </div>

            {/* WRITE BUTTON */}
            <div 
              onClick={() => setShowLangPicker(true)}
              className="rounded-xl p-3 flex items-center gap-3 border transition-all cursor-pointer bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand/50 group"
            >
               <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-brand/10 text-brand group-hover:bg-brand group-hover:text-white transition-colors"><PenTool size={18} /></div>
               <div className="flex-1"><div className="font-medium text-slate-500 dark:text-slate-400 group-hover:text-brand">{t('write_story')}</div></div>
               <div className="text-brand text-xs font-bold px-3 py-1 bg-brand/10 rounded-full">POST</div>
            </div>

            {/* FEED */}
            {feedArticles.length === 0 ? (
                <div className="text-center py-10 text-slate-500">
                    {t('no_articles')} <br/> {t('be_first')}
                </div>
            ) : (
                feedArticles.map(article => (
                    <div 
                        key={article.id}
                        onClick={() => { setCurrentReaderId(article.id); setView('reader'); }}
                        className="group bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:border-brand/30 dark:hover:border-brand/30 transition-all duration-300 cursor-pointer"
                    >
                        <div className="aspect-[2/1] relative overflow-hidden">
                            <img src={article.imageUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                            <div className="absolute top-3 left-3 flex gap-2">
                                <span className="bg-white/90 dark:bg-black/80 backdrop-blur text-slate-900 dark:text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm">{article.level}</span>
                            </div>
                        </div>
                        <div className="p-5">
                            <div className="flex gap-2 mb-3">{article.tags.map(tag => (<span key={tag} className="text-[10px] font-bold uppercase tracking-wider text-brand bg-brand-50 dark:bg-brand-900/10 px-2 py-1 rounded">{tag}</span>))}</div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 leading-snug font-jp group-hover:text-brand transition-colors">{article.title}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-4">{article.subtitle}</p>
                            <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-700/50 pt-4">
                                <div className="flex items-center gap-2"><img src={article.authorAvatar} className="w-6 h-6 rounded-full" /><span className="text-xs font-medium text-slate-600 dark:text-slate-300">{article.author}</span></div>
                                <span className="text-xs text-slate-400">{article.timeAgo}</span>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </main>
      )}
      
      {/* OTHER TABS */}
      {activeTab === 'explore' && (
        <div className="max-w-2xl mx-auto px-4 py-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm mb-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{t('explore')}</h2>
            <div className="relative mb-4">
                <input 
                    type="text" 
                    placeholder={t('search_ph')} 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand text-slate-900 dark:text-white" 
                />
                <Search className="absolute left-3 top-3.5 text-slate-400" size={20} />
            </div>
            
            {/* Search Results */}
            {searchQuery && (
                <div className="space-y-4 animate-fade-in">
                    <h3 className="text-sm font-bold text-slate-500 uppercase">Results</h3>
                    {exploreArticles.length > 0 ? exploreArticles.map(article => (
                        <div 
                            key={article.id} 
                            onClick={() => { setCurrentReaderId(article.id); setView('reader'); }}
                            className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl flex gap-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                            <img src={article.imageUrl} className="w-16 h-16 rounded-lg object-cover bg-slate-200" />
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white line-clamp-1">{article.title}</h4>
                                <p className="text-xs text-slate-500 mb-1">{article.author}</p>
                                <span className="text-[10px] bg-white dark:bg-slate-600 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-500 text-slate-600 dark:text-slate-300">{article.level}</span>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-8 text-slate-400">
                            No stories found matching "{searchQuery}"
                        </div>
                    )}
                </div>
            )}
            
            {!searchQuery && (
                <div className="text-center py-10 text-slate-400">
                    <Search size={48} className="mx-auto mb-4 opacity-20" />
                    <p>Type to search stories and authors...</p>
                </div>
            )}
            </div>
        </div>
      )}

      {activeTab === 'saved' && (
        <div className="max-w-2xl mx-auto px-4 py-6">
            <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('saved')}</h2>
            </div>
            {articles.filter(a => savedArticleIds.has(a.id)).map(article => (
                <div key={article.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 flex gap-4 border border-slate-100 dark:border-slate-700 shadow-sm mb-4" onClick={() => { setCurrentReaderId(article.id); setView('reader'); }}>
                    <img src={article.imageUrl} className="w-20 h-20 rounded-lg object-cover" />
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white line-clamp-1">{article.title}</h3>
                        <p className="text-xs text-slate-500 mb-2">{article.author}</p>
                        <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">{article.level}</span>
                    </div>
                </div>
            ))}
        </div>
      )}

      {activeTab === 'profile' && (
        <ProfileView 
          profile={userProfile} 
          isWriterUnlocked={userProfile ? unlockedLanguages.has(userProfile.targetLanguage) : false} 
          onOpenLangPicker={() => setShowLangPicker(true)}
          onOpenSettings={() => setView('settings')}
          t={t}
        />
      )}
      
      {/* LANGUAGE PICKER MODAL */}
      {showLangPicker && (
        <LanguagePickerModal 
            unlockedSet={unlockedLanguages}
            onClose={() => setShowLangPicker(false)}
            onSelect={(lang: string, isLocked: boolean) => {
                setShowLangPicker(false);
                if (isLocked) {
                    setSelectedLangForQuiz(lang);
                    setView('quiz');
                } else {
                    setSelectedLangForEditor(lang);
                    setView('editor');
                }
            }}
            t={t}
        />
      )}

      {/* RENDER CURRENT READER */}
      {view === 'reader' && currentReaderId && (
          <div className="fixed inset-0 z-50 bg-white dark:bg-[#0f1115]">
              {/* Simplified reader logic call just to show we handle it */}
              <Reader 
                article={articles.find(a => a.id === currentReaderId)} 
                onClose={() => { setView('home'); setCurrentReaderId(null); }}
                comments={currentComments} onUpdateComments={setCurrentComments} 
                isSaved={savedArticleIds.has(currentReaderId)} 
                onToggleSave={() => handleToggleSave(currentReaderId)}
               />
          </div>
      )}

      {view === 'home' && (
        <nav className="fixed bottom-0 w-full bg-white/90 dark:bg-[#0f1115]/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 pb-safe z-40">
          <div className="flex justify-around items-center h-16 max-w-2xl mx-auto px-2">
             {[
               { id: 'home', icon: Home, label: t('continue') }, // Hacky label reuse for demo
               { id: 'explore', icon: Search, label: t('explore').split(' ')[0] },
               { id: 'saved', icon: Bookmark, label: t('saved').split(' ')[0] },
               { id: 'profile', icon: User, label: t('profile') }
             ].map(item => (
               <button key={item.id} onClick={() => setActiveTab(item.id as TabState)} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all w-16 ${activeTab === item.id ? 'text-brand' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                 <item.icon size={24} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                 <span className="text-[10px] font-medium">{item.label}</span>
               </button>
             ))}
          </div>
        </nav>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);