import { useEffect, useRef, useState } from 'react';
import { EMPTY_FORM, sendContact, validateContact } from './contact.js';

const EMAIL = 'aakashgarude@gmail.com';
const REPO = 'https://github.com/Aakash-0506/aakash-portfolio';
const STACK = [
  { title: 'Backend', symbol: '{ }', description: 'The application logic that connects a visitor’s request to a useful response.', practice: ['Request validation and clear API responses', 'Contact limits and email notifications'], items: ['C#', '.NET', 'ASP.NET Core'] },
  { title: 'Frontend', symbol: '</>', description: 'Responsive interfaces that stay clear and usable across screen sizes.', practice: ['React components and form feedback', 'Keyboard navigation and theme switching'], items: ['React', 'HTML', 'CSS', 'JavaScript'] },
  { title: 'Database', symbol: '[ ]', description: 'Structured storage that keeps contact messages safe before an email is attempted.', practice: ['SQL Server tables and parameterized queries', 'Store-first contact message flow'], items: ['Microsoft SQL Server'] },
];

const PROJECT_FLOW = [
  { title: 'Interface', tool: 'React', text: 'The visitor writes a message. The form checks their input and gives clear feedback.' },
  { title: 'API', tool: 'ASP.NET Core', text: 'The server validates the request again and applies contact limits before saving it.' },
  { title: 'Data & notification', tool: 'SQL Server + Gmail', text: 'The message is stored first. The server then attempts an email notification and reports the result.' },
];

function Icon({ name, ...props }) {
  const paths = {
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    external: <><path d="M7 17 17 7M7 7h10v10" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    close: <><path d="m6 6 12 12M6 18 18 6" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></>,
    moon: <><path d="M20 14A8.5 8.5 0 0 1 10 4a8.5 8.5 0 1 0 10 10Z" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    code: <><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" /></>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.arrow}</svg>;
}

function ContactForm() {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const formRef = useRef(null);
  const focusField = useRef(null);

  useEffect(() => {
    if (!busy && focusField.current) {
      formRef.current?.elements.namedItem(focusField.current)?.focus();
      focusField.current = null;
    }
  }, [busy, errors]);

  async function submit(event) {
    event.preventDefault();
    if (sending.current) return;
    const validation = validateContact(form);
    setErrors(validation);
    setStatus(null);
    if (Object.keys(validation).length) {
      focusField.current = Object.keys(validation)[0];
      return;
    }
    sending.current = true;
    setBusy(true);
    try {
      const result = await sendContact(form);
      setStatus(result);
      setForm({ ...EMPTY_FORM });
    } catch (error) {
      if (error.fieldErrors && Object.keys(error.fieldErrors).length) {
        setErrors(error.fieldErrors);
        focusField.current = Object.keys(error.fieldErrors)[0];
      }
      const text = error.name === 'TimeoutError'
        ? 'The request timed out and may still be processing. Please email me directly before resending.'
        : error instanceof TypeError ? 'Could not connect. Please email aakashgarude@gmail.com directly.' : error.message || 'Could not connect. Please email me directly.';
      setStatus({ kind: 'error', text });
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => { const next = { ...current }; delete next[name]; return next; });
  };
  const fields = [
    { name: 'name', label: 'Your name', placeholder: 'Alex Smith', maxLength: 100, autoComplete: 'name' },
    { name: 'email', label: 'Email address', placeholder: 'alex@example.com', type: 'email', maxLength: 254, autoComplete: 'email' },
    { name: 'subject', label: 'Subject', placeholder: 'What would you like to talk about?', maxLength: 150, autoComplete: 'off' },
    { name: 'message', label: 'Your message', placeholder: 'Tell me a little about your idea…', maxLength: 5000, autoComplete: 'off' },
  ];
  return <form ref={formRef} className="contact-form" onSubmit={submit} noValidate aria-busy={busy}>
    <div className="form-grid">
      {fields.map(({ name, label, ...inputProps }) => <div className={'field ' + (name === 'subject' || name === 'message' ? 'wide' : '')} key={name}>
        <label htmlFor={name}>{label}</label>
        {name === 'message'
          ? <textarea id={name} name={name} rows="5" value={form[name]} onChange={update} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? name + '-error' : undefined} required disabled={busy} {...inputProps} />
          : <input id={name} name={name} type="text" value={form[name]} onChange={update} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? name + '-error' : undefined} required disabled={busy} {...inputProps} />}
        {errors[name] && <small id={name + '-error'} className="field-error">{errors[name]}</small>}
      </div>)}
    </div>
    <div className="honeypot" aria-hidden="true"><label htmlFor="website">Leave this blank</label><input id="website" name="website" value={form.website} onChange={update} tabIndex="-1" autoComplete="off" /></div>
    <div className="form-footer"><span>You can also email me directly.</span><button className="button primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send message'}<Icon name="arrow" /></button></div>
    <div aria-live="polite" aria-atomic="true">{status && <p className={'form-status ' + status.kind} role={status.kind === 'error' ? 'alert' : 'status'}>{status.text}</p>}</div>
    <p className="privacy-note">Your name, email and message are stored so I can respond. Please avoid sharing sensitive information.</p>
  </form>;
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const menuButton = useRef(null);
  const navigation = useRef(null);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('portfolio-theme') === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('portfolio-theme', theme); } catch { /* Storage is optional. */ }
  }, [theme]);

  useEffect(() => {
    if (!menuOpen) return;
    navigation.current?.querySelector('a')?.focus();
    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [menuOpen]);

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <a className="wordmark" href="#home" aria-label="Aakash Garude home"><span className="monogram">ag<span>.</span></span><span className="wordmark-name">AAKASH<br />GARUDE</span></a>
      <nav ref={navigation} id="navigation" className={menuOpen ? 'nav open' : 'nav'} aria-label="Main navigation">
        {['About', 'Stack', 'Work', 'Contact'].map((label) => <a key={label} href={'#' + label.toLowerCase()} onClick={() => setMenuOpen(false)}>{label}</a>)}
      </nav>
      <div className="header-actions">
        <button className="icon-button theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={'Switch to ' + (theme === 'light' ? 'dark' : 'light') + ' theme'}><Icon name={theme === 'light' ? 'moon' : 'sun'} /></button>
        <a className="header-contact" href="#contact">Let’s talk <Icon name="external" /></a>
        <button ref={menuButton} className="icon-button menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="navigation"><Icon name={menuOpen ? 'close' : 'menu'} /></button>
      </div>
    </header>
    <main id="main">
      <section className="hero section-shell" id="home" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" /> ASPIRING FULL-STACK DEVELOPER</p>
          <h1 id="hero-title">Hi, I’m Aakash.<br /><span className="serif">I build for the web.</span></h1>
          <p className="hero-intro">I’m <strong>Aakash Garude</strong>, learning to connect responsive React interfaces with C# APIs and SQL Server. This portfolio puts that learning into practice.</p>
          <div className="hero-actions"><a className="button primary" href="#work">View my project <Icon name="arrow" /></a><a className="text-link" href="#contact">Contact me <Icon name="external" /></a></div>
          <div className="hero-footnote"><span className="small-cross">✳</span><span>From the browser to the database.<br /><strong>Building my foundations through practice.</strong></span></div>
        </div>
        <div className="hero-visual" role="img" aria-label="My development stack: React user interface, ASP.NET Core API and SQL Server database">
          <div className="visual-grid" />
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="code-window">
            <div className="window-chrome"><div className="window-dots"><i /><i /><i /></div><span>portfolio / hello.cs</span><Icon name="code" /></div>
            <div className="code-content"><span className="code-comment">// Every idea starts somewhere.</span><br /><span className="code-purple">public class</span> <span className="code-orange">Developer</span><br />{'{'}<br />{'  '}<span className="code-purple">string</span> Name = <span className="code-green">"Aakash"</span>;<br />{'  '}<span className="code-purple">string</span> Focus = <span className="code-green">"Build & learn"</span>;<br />{'}'}</div>
            <div className="code-terminal"><span>›</span> Turning curiosity into code<span className="cursor">_</span></div>
          </div>
          <div className="stack-chip chip-react"><span className="chip-symbol">⚛</span><span><small>INTERFACE</small><strong>React</strong></span></div>
          <div className="stack-chip chip-dotnet"><span className="dotnet-symbol">.NET</span><span><small>APPLICATION</small><strong>ASP.NET Core</strong></span></div>
          <div className="stack-chip chip-sql"><svg width="28" height="32" viewBox="0 0 28 32" fill="none" aria-hidden="true"><ellipse cx="14" cy="7" rx="11" ry="4" stroke="currentColor" strokeWidth="1.5" /><path d="M3 7v17c0 5 22 5 22 0V7M3 15c0 5 22 5 22 0" stroke="currentColor" strokeWidth="1.5" /></svg><span><small>DATA</small><strong>SQL Server</strong></span></div>
          <span className="visual-caption">IDEA → INTERFACE → APPLICATION</span>
        </div>
      </section>
      <div className="stack-strip" aria-hidden="true"><span>C#</span><span>.NET</span><span>ASP.NET CORE</span><span>REACT</span><span>HTML</span><span>CSS</span><span>JAVASCRIPT</span><span>SQL SERVER</span></div>
      <section id="about" className="about section-shell section-pad" aria-labelledby="about-title">
        <div className="section-label"><span>01 / ABOUT ME</span><span className="small-cross">✳</span></div>
        <div className="about-content"><h2 id="about-title">Learning by doing.<br /><span className="serif">One step at a time.</span></h2><div className="about-text"><p>I’m at the beginning of my development journey, building my foundations in C#, ASP.NET Core and React.</p><p>My current focus is understanding the whole application: what happens in the browser, how the API handles a request, and where the data goes. This portfolio is my place to practise that connection.</p><a className="text-link" href="https://github.com/Aakash-0506" target="_blank" rel="noreferrer">Follow my journey on GitHub <Icon name="external" /></a></div></div>
        <div className="principles"><div><span>01</span><h3>Clear interfaces</h3><p>Layouts, labels and feedback that help people find their way.</p></div><div><span>02</span><h3>Connected applications</h3><p>Follow each request from the React interface to the API and database.</p></div><div><span>03</span><h3>Practical learning</h3><p>Build, test and improve a project one useful feature at a time.</p></div></div>
      </section>
      <section id="stack" className="stack-section section-pad" aria-labelledby="stack-title"><div className="section-shell"><div className="section-label"><span>02 / MY TOOLKIT</span><span>THE TOOLS I’M BUILDING WITH</span></div><div className="section-heading"><h2 id="stack-title">From screen<br /><span className="serif">to server.</span></h2><p>What I’m practising across the<br />frontend, backend and database.</p></div><div className="stack-cards">{STACK.map((group) => <article className="stack-card" key={group.title}><span className="stack-symbol" aria-hidden="true">{group.symbol}</span><h3>{group.title}</h3><p>{group.description}</p><ul className="stack-practice">{group.practice.map((item) => <li key={item}><Icon name="check" /><span>{item}</span></li>)}</ul><div className="tags">{group.items.map((item) => <span key={item}>{item}</span>)}</div></article>)}</div></div></section>
      <section id="work" className="work section-shell section-pad" aria-labelledby="work-title"><div className="section-label"><span>03 / FEATURED PROJECT</span><span>A PERSONAL PROJECT</span></div><div className="section-heading"><h2 id="work-title">One project.<br /><span className="serif">The complete flow.</span></h2></div><article className="project-card"><div className="project-preview" role="img" aria-label="Illustration of this portfolio"><div className="mini-browser"><div className="mini-chrome"><span>● ● ●</span><span>aakash / portfolio</span></div><div className="mini-content"><span className="mini-brand">ag.</span><span className="mini-nav">ABOUT &nbsp; STACK &nbsp; CONTACT</span><div className="mini-heading">Hi, I’m Aakash.<br /><em>I build for the web.</em></div><div className="mini-line" /><div className="mini-line short" /><span className="mini-button">Explore my work ↗</span><div className="mini-orb">{'{ }'}</div></div></div><div className="project-index">PROJECT / 001</div></div><div className="project-copy"><div className="project-category"><span>PERSONAL PROJECT</span><span className="project-dot" /></div><h3>Personal developer portfolio</h3><p>A place to introduce myself and put a full application together: a React interface, an ASP.NET Core contact API, SQL Server storage and Gmail notification support.</p><div className="tags"><span>React</span><span>ASP.NET Core</span><span>SQL Server</span></div><div className="project-actions"><button className="text-link" type="button" aria-expanded={detailsOpen} aria-controls="project-details" onClick={() => setDetailsOpen(!detailsOpen)}>{detailsOpen ? 'Hide details' : 'Project details'}<Icon name={detailsOpen ? 'close' : 'arrow'} /></button><a className="text-link" href={REPO} target="_blank" rel="noreferrer">View on GitHub <Icon name="external" /></a></div></div><div id="project-details" className="project-details" hidden={!detailsOpen}><h4>How it fits together</h4><p>A contact message moves through three connected parts of the application.</p><ol className="project-flow" aria-label="Contact message flow">{PROJECT_FLOW.map((step, index) => <li key={step.title}><span className="flow-number" aria-hidden="true">0{index + 1}</span><span className="flow-tool">{step.tool}</span><h5>{step.title}</h5><p>{step.text}</p></li>)}</ol><div className="project-features"><h4>What I’m practising</h4><ul><li>Responsive layouts and accessible interactions.</li><li>Client and server validation with clear error states.</li><li>SQL storage before email notification attempts.</li></ul></div><p className="project-detail-note">Email notifications need the site’s server, database and private Gmail settings to be configured. You can also contact me directly by email.</p></div></article></section>
      <section id="contact" className="contact-section section-pad" aria-labelledby="contact-title"><div className="section-shell"><div className="section-label"><span>04 / GET IN TOUCH</span><span>LET’S START A CONVERSATION</span></div><div className="contact-layout"><div className="contact-copy"><h2 id="contact-title">Have a question?<br /><span className="serif">Say hello.</span></h2><p>For an opportunity, collaboration or feedback on this project, send me a message or email me directly.</p><a className="email-link" href={'mailto:' + EMAIL}><Icon name="mail" /><span>{EMAIL}</span><Icon name="external" /></a><a className="text-link github-contact" href="https://github.com/Aakash-0506" target="_blank" rel="noreferrer">Find me on GitHub <Icon name="external" /></a></div><ContactForm /></div></div></section>
    </main>
    <footer className="site-footer section-shell"><a className="monogram" href="#home" aria-label="Back to top">ag<span>.</span></a><p>© {new Date().getFullYear()} Aakash Garude</p><span>Built with curiosity, React & .NET.</span><a className="text-link" href="#home">Back to top <Icon name="external" /></a></footer>
  </>;
}
