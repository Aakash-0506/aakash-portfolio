import { useEffect, useRef, useState } from 'react';
import { EMPTY_FORM, sendContact, validateContact } from './contact.js';

const EMAIL = 'aakashgarude@gmail.com';
const REPO = 'https://github.com/Aakash-0506/aakash-portfolio';
const STACK = [
  { title: 'Backend', symbol: '{ }', description: 'The logic behind the experience.', items: ['C#', '.NET Core', 'ASP.NET Core'] },
  { title: 'Frontend', symbol: '</>', description: 'Interfaces made for people.', items: ['React', 'HTML', 'CSS', 'JavaScript'] },
  { title: 'Database', symbol: '[ ]', description: 'A place for every piece of data.', items: ['Microsoft SQL Server'] },
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

  async function submit(event) {
    event.preventDefault();
    if (sending.current) return;
    const validation = validateContact(form);
    setErrors(validation);
    setStatus(null);
    if (Object.keys(validation).length) {
      formRef.current?.elements.namedItem(Object.keys(validation)[0])?.focus();
      return;
    }
    sending.current = true;
    setBusy(true);
    try {
      const result = await sendContact(form);
      setStatus(result);
      setForm({ ...EMPTY_FORM });
    } catch (error) {
      const text = error.name === 'TimeoutError'
        ? 'The request timed out and may still be processing. Please email me directly before resending.'
        : error instanceof TypeError ? 'Could not connect. Please email aakashgarude@gmail.com directly.' : error.message || 'Could not connect. Please email me directly.';
      setStatus({ kind: 'error', text });
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
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
    <div className="form-footer"><span>Prefer email? Use the address alongside.</span><button className="button primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send message'}<Icon name="arrow" /></button></div>
    <div aria-live="polite" aria-atomic="true">{status && <p className={'form-status ' + status.kind} role={status.kind === 'error' ? 'alert' : 'status'}>{status.text}</p>}</div>
    <p className="privacy-note">Your name, email and message are stored so I can respond. Please avoid sharing sensitive information.</p>
  </form>;
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
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
    const onEscape = (event) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [menuOpen]);

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header">
      <a className="wordmark" href="#home" aria-label="Aakash Garude home"><span className="monogram">ag<span>.</span></span><span className="wordmark-name">AAKASH<br />GARUDE</span></a>
      <nav id="navigation" className={menuOpen ? 'nav open' : 'nav'} aria-label="Main navigation">
        {['About', 'Stack', 'Work', 'Contact'].map((label) => <a key={label} href={'#' + label.toLowerCase()} onClick={() => setMenuOpen(false)}>{label}</a>)}
      </nav>
      <div className="header-actions">
        <button className="icon-button theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={'Switch to ' + (theme === 'light' ? 'dark' : 'light') + ' theme'}><Icon name={theme === 'light' ? 'moon' : 'sun'} /></button>
        <a className="header-contact" href="#contact">Let’s talk <Icon name="external" /></a>
        <button className="icon-button menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="navigation"><Icon name={menuOpen ? 'close' : 'menu'} /></button>
      </div>
    </header>
    <main id="main">
      <section className="hero section-shell" id="home" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" /> C# · REACT · SQL SERVER</p>
          <h1 id="hero-title">Thoughtful code.<br /><span className="serif">Useful experiences.</span></h1>
          <p className="hero-intro">Hi, I’m <strong>Aakash Garude.</strong> I’m a developer exploring the space between clear interfaces and practical backend logic.</p>
          <div className="hero-actions"><a className="button primary" href="#work">Explore my work <Icon name="arrow" /></a><a className="text-link" href="#contact">Get in touch <Icon name="external" /></a></div>
          <div className="hero-footnote"><span className="small-cross">✳</span><span>Learning by building.<br /><strong>One thoughtful project at a time.</strong></span></div>
        </div>
        <div className="hero-visual" aria-label="My development stack: React user interface, ASP.NET Core API and SQL Server database">
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
      <div className="stack-strip" aria-hidden="true"><span>C#</span><span>.NET CORE</span><span>ASP.NET CORE</span><span>REACT</span><span>HTML</span><span>CSS</span><span>JAVASCRIPT</span><span>MSSQL</span></div>
      <section id="about" className="about section-shell section-pad" aria-labelledby="about-title">
        <div className="section-label"><span>01 / ABOUT ME</span><span className="small-cross">✳</span></div>
        <div className="about-content"><h2 id="about-title">Curious by nature.<br /><span className="serif">A builder by choice.</span></h2><div className="about-text"><p>I’m at the beginning of my development journey, building my foundation in C#, ASP.NET Core and React.</p><p>This portfolio is my first project: a place to put what I’m learning into practice, from responsive layouts to APIs, databases and a working contact flow.</p><a className="text-link" href="https://github.com/Aakash-0506" target="_blank" rel="noreferrer">Follow my journey on GitHub <Icon name="external" /></a></div></div>
        <div className="principles"><div><span>01</span><h3>Keep it clear</h3><p>Make interfaces easy to understand.</p></div><div><span>02</span><h3>Build the whole flow</h3><p>Connect the frontend, API and data.</p></div><div><span>03</span><h3>Keep learning</h3><p>Improve through hands-on practice.</p></div></div>
      </section>
      <section id="stack" className="stack-section section-pad" aria-labelledby="stack-title"><div className="section-shell"><div className="section-label"><span>02 / MY TOOLKIT</span><span>THE TOOLS I’M BUILDING WITH</span></div><div className="section-heading"><h2 id="stack-title">From screen<br /><span className="serif">to server.</span></h2><p>A connected stack for building<br />modern web applications.</p></div><div className="stack-cards">{STACK.map((group) => <article className="stack-card" key={group.title}><span className="stack-symbol">{group.symbol}</span><h3>{group.title}</h3><p>{group.description}</p><div className="tags">{group.items.map((item) => <span key={item}>{item}</span>)}</div></article>)}</div></div></section>
      <section id="work" className="work section-shell section-pad" aria-labelledby="work-title"><div className="section-label"><span>03 / SELECTED WORK</span><span>MY FIRST PROJECT</span></div><div className="section-heading"><h2 id="work-title">A small beginning.<br /><span className="serif">Built with intention.</span></h2></div><article className="project-card"><div className="project-preview" aria-label="Illustration of this portfolio"><div className="mini-browser"><div className="mini-chrome"><span>● ● ●</span><span>aakash / portfolio</span></div><div className="mini-content"><span className="mini-brand">ag.</span><span className="mini-nav">ABOUT &nbsp; STACK &nbsp; CONTACT</span><div className="mini-heading">Thoughtful code.<br /><em>Useful experiences.</em></div><div className="mini-line" /><div className="mini-line short" /><span className="mini-button">Explore my work ↗</span><div className="mini-orb">{'{ }'}</div></div></div><div className="project-index">PROJECT / 001</div></div><div className="project-copy"><div className="project-category"><span>PERSONAL PROJECT</span><span className="project-dot" /></div><h3>Developer portfolio</h3><p>My personal corner of the web. A responsive React interface connected to an ASP.NET Core API, with contact messages stored in SQL Server and delivered through Gmail.</p><div className="tags"><span>React</span><span>ASP.NET Core</span><span>MSSQL</span></div><div className="project-actions"><button className="text-link" type="button" aria-expanded={detailsOpen} aria-controls="project-details" onClick={() => setDetailsOpen(!detailsOpen)}>{detailsOpen ? 'Hide details' : 'Project details'}<Icon name={detailsOpen ? 'close' : 'arrow'} /></button><a className="text-link" href={REPO} target="_blank" rel="noreferrer">Source code <Icon name="external" /></a></div></div>{detailsOpen && <div id="project-details" className="project-details"><h4>How it fits together</h4><p>React handles the interface and form validation. The ASP.NET Core API validates submissions, applies rate limits and stores each message in SQL Server before attempting a Gmail email notification.</p><ul><li>Responsive layouts, accessible navigation and a light/dark theme.</li><li>Server-side validation, a spam honeypot and per-IP contact limits.</li><li>Honest delivery feedback when an email notification cannot be sent.</li></ul><p className="project-detail-note">Live contact delivery requires the API, SQL Server and private Gmail settings to be configured by the site owner.</p></div>}</article></section>
      <section id="contact" className="contact-section section-pad" aria-labelledby="contact-title"><div className="section-shell"><div className="section-label"><span>04 / GET IN TOUCH</span><span>LET’S START A CONVERSATION</span></div><div className="contact-layout"><div className="contact-copy"><h2 id="contact-title">Have an idea?<br /><span className="serif">Let’s talk.</span></h2><p>A question, an opportunity, or just a hello.<br />I’d love to hear from you.</p><a className="email-link" href={'mailto:' + EMAIL}><Icon name="mail" /><span>{EMAIL}</span><Icon name="external" /></a><a className="text-link github-contact" href="https://github.com/Aakash-0506" target="_blank" rel="noreferrer">Find me on GitHub <Icon name="external" /></a></div><ContactForm /></div></div></section>
    </main>
    <footer className="site-footer section-shell"><a className="monogram" href="#home" aria-label="Back to top">ag<span>.</span></a><p>© {new Date().getFullYear()} Aakash Garude</p><span>Built with curiosity, React & .NET.</span><a className="text-link" href="#home">Back to top <Icon name="external" /></a></footer>
  </>;
}
