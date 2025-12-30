import React, { useState, useRef } from 'react';
import { generatePDF } from './services/pdfService';
import { ResumeData, Section, TemplateType } from './types';
import { ResumePreview } from './components/ResumePreview';
import { SortableSectionList } from './components/SortableSectionList';
import { Button } from './components/ui/Button';
import { Layout, Palette, Download, Upload, FileText, ChevronLeft, Eye, User, Trash2, Settings } from 'lucide-react';

const INITIAL_DATA: ResumeData = {
  template: 'modern',
  primaryColor: '#1f2937',
  contentScale: 1,
  personalInfo: {
    fullName: 'Max K. Silva',
    title: 'Jovem Aprendiz',
    email: 'exemplo@gmail.com',
    phone: '(12) 3456-7890',
    address: 'Rua Duque de Caxias, 1, Centro - Buenos Aires, PE',
    linkedin: 'linkedin.com/in/max-k-silva',
    photoUrl: 'https://picsum.photos/200/200',
    summary: 'Busco minha primeira oportunidade de emprego como Jovem Aprendiz, visando desenvolver habilidades profissionais e contribuir com dedicação e vontade de aprender para o crescimento da empresa.'
  },
  sections: [
    {
      id: 'obj',
      title: 'Objetivos Profissionais',
      type: 'text',
      isVisible: true,
      items: [{ id: '1', title: '', subtitle: '', description: 'Desenvolver habilidades em administração e atendimento ao cliente.', date: '' }]
    },
    {
      id: 'edu',
      title: 'Formação',
      type: 'education',
      isVisible: true,
      items: [
        { id: '1', title: 'Escola Pacheco e Lacerda', subtitle: 'Cursando 1º ano do ensino médio', date: '2025' }
      ]
    },
    {
      id: 'qual',
      title: 'Qualificações',
      type: 'skills',
      isVisible: true,
      items: [
        { id: '1', description: 'Facilidade em trabalhar em equipe' },
        { id: '2', description: 'Boa comunicação' },
        { id: '3', description: 'Habilidade em organização e pontualidade' },
        { id: '4', description: 'Conhecimento básico em digitalização' }
      ]
    },
    {
      id: 'lang',
      title: 'Idiomas',
      type: 'skills',
      isVisible: true,
      items: [
        { id: '1', description: 'Português: Nativo' },
        { id: '2', description: 'Inglês: Básico' },
        { id: '3', description: 'Espanhol: Básico' }
      ]
    },
    {
        id: 'courses',
        title: 'Cursos',
        type: 'education',
        isVisible: true,
        items: [
            { id: '1', title: 'Hanover e Tavares', subtitle: 'Curso de Idioma (Espanhol)', date: '2023' },
            { id: '2', title: 'Empresa Ícaro', subtitle: 'Curso Comunicação Escrita', date: '2020' }
        ]
    }
  ]
};

function App() {
  const [resumeData, setResumeData] = useState<ResumeData>(INITIAL_DATA);
  const [view, setView] = useState<'home' | 'editor' | 'preview'>('home');
  const [isDownloading, setIsDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePersonalInfoChange = (field: string, value: string | null) => {
    setResumeData(prev => ({
      ...prev,
      personalInfo: { ...prev.personalInfo, [field]: value }
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      handlePersonalInfoChange('photoUrl', url);
    }
  };

  const handleReorderSections = (newSections: Section[]) => {
    setResumeData(prev => ({ ...prev, sections: newSections }));
  };

  const handleUpdateSection = (id: string, updatedSection: Section) => {
    setResumeData(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === id ? updatedSection : s)
    }));
  };

  const handleAddSection = () => {
    const newSection: Section = {
      id: Date.now().toString(),
      title: 'Nova Seção',
      type: 'experience',
      isVisible: true,
      items: []
    };
    setResumeData(prev => ({ ...prev, sections: [...prev.sections, newSection] }));
  };

  const handleRemoveSection = (id: string) => {
    setResumeData(prev => ({
      ...prev,
      sections: prev.sections.filter(s => s.id !== id)
    }));
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    // Temporary switch to preview view to ensure rendering for PDF
    const previousView = view;
    if (view !== 'preview') setView('preview');
    
    // Wait for render
    setTimeout(async () => {
      await generatePDF('resume-preview-id', `curriculo-${resumeData.personalInfo.fullName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
      setIsDownloading(false);
      setView(previousView);
    }, 1000);
  };

  const TemplateCard = ({ type, title, previewColor }: { type: TemplateType, title: string, previewColor: string }) => (
    <div 
        onClick={() => {
            setResumeData(prev => ({ ...prev, template: type }));
            setView('editor');
        }}
        className="cursor-pointer group relative bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-blue-500 overflow-hidden"
    >
        <div className={`h-32 w-full ${previewColor}`}></div>
        <div className="p-4">
            <h3 className="text-lg font-bold text-gray-800">{title}</h3>
            <p className="text-sm text-gray-500 mt-1">Design profissional e limpo.</p>
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors"></div>
    </div>
  );

  // --- VIEW: HOME ---
  if (view === 'home') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-3xl mb-12">
            <h1 className="text-5xl font-extrabold text-gray-900 mb-6 tracking-tight">
                Resume Builder
            </h1>
            <p className="text-xl text-gray-600 mb-8">
                Crie um currículo profissional em minutos. Escolha um modelo, preencha seus dados e baixe em PDF.
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
            <TemplateCard type="modern" title="Moderno" previewColor="bg-gray-800" />
            <TemplateCard type="classic" title="Clássico" previewColor="bg-white border-b-4 border-gray-800" />
            <TemplateCard type="minimal" title="Minimalista" previewColor="bg-blue-600" />
        </div>
      </div>
    );
  }

  // --- VIEW: EDITOR & PREVIEW ---
  return (
    <div className="min-h-screen flex flex-col h-screen overflow-hidden">
        {/* Navbar */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shrink-0 z-20">
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={() => setView('home')} size="sm">
                    <ChevronLeft className="mr-1" size={18} /> Início
                </Button>
                <span className="font-bold text-xl text-gray-800 hidden md:block">Resume Builder</span>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="hidden md:flex gap-2 mr-4">
                     <button 
                        onClick={() => setResumeData(prev => ({...prev, template: 'modern'}))}
                        className={`p-2 rounded ${resumeData.template === 'modern' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}`}
                     >Moderno</button>
                      <button 
                        onClick={() => setResumeData(prev => ({...prev, template: 'classic'}))}
                        className={`p-2 rounded ${resumeData.template === 'classic' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}`}
                     >Clássico</button>
                      <button 
                        onClick={() => setResumeData(prev => ({...prev, template: 'minimal'}))}
                        className={`p-2 rounded ${resumeData.template === 'minimal' ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}`}
                     >Minimal</button>
                </div>

                <Button 
                    variant="secondary" 
                    className="md:hidden" 
                    onClick={() => setView(view === 'editor' ? 'preview' : 'editor')}
                >
                    {view === 'editor' ? <Eye size={18} className="mr-2"/> : <Layout size={18} className="mr-2"/>}
                    {view === 'editor' ? 'Ver Preview' : 'Editar'}
                </Button>

                <Button onClick={handleDownload} disabled={isDownloading}>
                    {isDownloading ? 'Gerando...' : <><Download size={18} className="mr-2" /> Baixar PDF</>}
                </Button>
            </div>
        </header>

        <main className="flex-1 flex overflow-hidden">
            {/* Left Panel: Editor Form */}
            <div className={`
                flex-1 overflow-y-auto p-6 bg-gray-50
                ${view === 'preview' ? 'hidden md:block md:w-1/2 lg:w-5/12' : 'w-full'}
            `}>
                <div className="max-w-2xl mx-auto space-y-8 pb-20">
                    
                    {/* Settings Section */}
                    <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                            <Settings className="mr-2 text-blue-600" size={20}/> Configurações
                        </h2>
                        <div className="space-y-2">
                             <div className="flex justify-between">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Tamanho do Conteúdo</label>
                                <span className="text-xs text-gray-500">{Math.round(resumeData.contentScale * 100)}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0.75" 
                                max="1.3" 
                                step="0.05"
                                value={resumeData.contentScale}
                                onChange={(e) => setResumeData(prev => ({ ...prev, contentScale: parseFloat(e.target.value) }))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                             <p className="text-xs text-gray-400">Ajuste para caber mais ou menos conteúdo na página.</p>
                        </div>
                    </section>

                    {/* Personal Info Section */}
                    <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                            <User className="mr-2 text-blue-600" size={20}/> Dados Pessoais
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="md:col-span-2 flex items-center gap-4 mb-2">
                                <div className="relative group w-20 h-20 shrink-0">
                                     {resumeData.personalInfo.photoUrl ? (
                                        <>
                                            <img src={resumeData.personalInfo.photoUrl} alt="Preview" className="w-full h-full object-cover rounded-full border border-gray-300" />
                                            <button 
                                                onClick={() => handlePersonalInfoChange('photoUrl', null)}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white p-1.5 rounded-full shadow-md hover:bg-red-600 transition-colors z-10"
                                                title="Remover foto"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </>
                                    ) : (
                                        <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-300 border-dashed"><User /></div>
                                    )}
                                </div>
                                
                                <div>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        accept="image/*"
                                        onChange={handlePhotoUpload}
                                    />
                                    <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                                        <Upload size={14} className="mr-2"/> {resumeData.personalInfo.photoUrl ? 'Alterar Foto' : 'Adicionar Foto'}
                                    </Button>
                                </div>
                             </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Nome Completo</label>
                                <input 
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={resumeData.personalInfo.fullName}
                                    onChange={(e) => handlePersonalInfoChange('fullName', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Cargo / Título</label>
                                    {resumeData.personalInfo.title && (
                                         <button onClick={() => handlePersonalInfoChange('title', '')} className="text-red-400 hover:text-red-600" title="Remover título">
                                            <Trash2 size={12} />
                                         </button>
                                    )}
                                </div>
                                <input 
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={resumeData.personalInfo.title}
                                    placeholder="Ex: Desenvolvedor Web"
                                    onChange={(e) => handlePersonalInfoChange('title', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Email</label>
                                <input 
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={resumeData.personalInfo.email}
                                    onChange={(e) => handlePersonalInfoChange('email', e.target.value)}
                                />
                            </div>
                             <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Telefone</label>
                                <input 
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={resumeData.personalInfo.phone}
                                    onChange={(e) => handlePersonalInfoChange('phone', e.target.value)}
                                />
                            </div>

                             <div className="md:col-span-2 space-y-1">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Linkedin</label>
                                    {resumeData.personalInfo.linkedin && (
                                         <button onClick={() => handlePersonalInfoChange('linkedin', '')} className="text-red-400 hover:text-red-600" title="Remover Linkedin">
                                            <Trash2 size={12} />
                                         </button>
                                    )}
                                </div>
                                <input 
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={resumeData.personalInfo.linkedin || ''}
                                    placeholder="Ex: linkedin.com/in/seu-perfil"
                                    onChange={(e) => handlePersonalInfoChange('linkedin', e.target.value)}
                                />
                            </div>

                             <div className="md:col-span-2 space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Endereço</label>
                                <input 
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={resumeData.personalInfo.address}
                                    onChange={(e) => handlePersonalInfoChange('address', e.target.value)}
                                />
                            </div>
                            <div className="md:col-span-2 space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase">Resumo Profissional</label>
                                <textarea 
                                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                                    value={resumeData.personalInfo.summary}
                                    onChange={(e) => handlePersonalInfoChange('summary', e.target.value)}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Draggable Sections */}
                    <SortableSectionList 
                        sections={resumeData.sections}
                        onReorder={handleReorderSections}
                        onUpdateSection={handleUpdateSection}
                        onRemoveSection={handleRemoveSection}
                        onAddSection={handleAddSection}
                    />

                </div>
            </div>

            {/* Right Panel: Live Preview */}
            <div className={`
                flex-1 bg-gray-200 overflow-y-auto flex justify-center p-8
                ${view === 'editor' ? 'hidden md:flex' : 'block'}
            `}>
                <div className="shadow-2xl max-w-[210mm] w-full bg-white min-h-[297mm] origin-top transform transition-transform duration-200 scale-90 lg:scale-100">
                    <ResumePreview data={resumeData} id="resume-preview-id" />
                </div>
            </div>
        </main>
    </div>
  );
}

export default App;