import { App, ItemView, MarkdownRenderer, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, TFile, WorkspaceLeaf, moment } from 'obsidian';

type Language = 'auto' | 'en' | 'de';
const MESSAGES = {
  en: {
    dayOverview: 'Day overview', chooseDay: 'Select a day from the calendar or use the Open day overview command.', noMatches: 'No matching entries found.',
    openCalendarWithSummary: 'Open calendar with day overview', openDayOverview: 'Open day overview', openTodayOverview: "Open today's overview",
    openCalendar: 'Open calendar', datePrompt: 'Date', invalidDate: 'Invalid date', source: 'Source', calendar: 'Calendar',
    previousMonth: 'Previous month', nextMonth: 'Next month', today: 'Today', weekdays: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    dateFormat: 'Date format', dateFormatDesc: 'Moment.js format, e.g. YYYY-MM-DD',
    materialize: 'Write summaries to files', materializeDesc: 'By default, show a virtual view. When enabled, Markdown files are created or overwritten.',
    outputFolder: 'Output folder', language: 'Language', languageDesc: 'Auto uses the Obsidian interface language.'
  },
  de: {
    dayOverview: 'Tagesübersicht', chooseDay: 'Wähle einen Tag im Kalender oder über den Befehl „Tagesübersicht öffnen“.', noMatches: 'Keine passenden Einträge gefunden.',
    openCalendarWithSummary: 'Kalender mit Tagesübersicht öffnen', openDayOverview: 'Tagesübersicht öffnen', openTodayOverview: 'Heutige Tagesübersicht öffnen',
    openCalendar: 'Kalender öffnen', datePrompt: 'Datum', invalidDate: 'Ungültiges Datum', source: 'Quelle', calendar: 'Kalender',
    previousMonth: 'Vorheriger Monat', nextMonth: 'Nächster Monat', today: 'Heute', weekdays: ['Mo','Di','Mi','Do','Fr','Sa','So'],
    dateFormat: 'Datumsformat', dateFormatDesc: 'Moment.js-Format, z. B. YYYY-MM-DD',
    materialize: 'Zusammenfassungen materialisieren', materializeDesc: 'Standardmäßig virtuelle Ansicht; bei Aktivierung werden Markdown-Dateien geschrieben und überschrieben.',
    outputFolder: 'Ausgabeordner', language: 'Sprache', languageDesc: 'Automatisch verwendet die Obsidian-Oberflächensprache.' 
  }
} as const;
type MessageKey = Exclude<keyof typeof MESSAGES['en'], 'weekdays'>;
const VIEW = 'day-aggregate-view';
const CALENDAR_VIEW = 'aggregate-calendar-view';
interface Settings { dateFormat: string; materialize: boolean; outputFolder: string; language: Language; }
const DEFAULT: Settings = { dateFormat: 'YYYY-MM-DD', materialize: false, outputFolder: 'Kalender', language: 'auto' };
interface Hit { path: string; line?: number; content: string; kind: 'note' | 'heading'; }

class DayView extends ItemView {
  plugin: DayAggregate;
  day = '';
  constructor(leaf: WorkspaceLeaf, plugin: DayAggregate) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW; }
  getDisplayText() { return this.day ? `${this.plugin.t('dayOverview')} ${this.day}` : this.plugin.t('dayOverview'); }
  getIcon() { return 'calendar-search'; }
  async onOpen() { await this.render(); }
  async render() {
    const el = this.contentEl; el.empty();
    if (!this.day) { el.createEl('p', {text:this.plugin.t('chooseDay')}); return; }
    el.createEl('h2', {text:`${this.plugin.t('dayOverview')} ${this.day}`});
    const hits = await this.plugin.collect(this.day);
    if (!hits.length) { el.createEl('p', {text:this.plugin.t('noMatches')}); return; }
    for (const hit of hits) {
      const block = el.createDiv({cls:'day-aggregate-hit'});
      const link = block.createEl('a', {text: `${hit.path}${hit.line !== undefined ? `:${hit.line+1}` : ''}`});
      link.href = '#';
      link.addEventListener('click', async (event) => {
        event.preventDefault();
        const file = this.app.vault.getAbstractFileByPath(hit.path);
        if (!(file instanceof TFile)) return;
        const leaf = this.app.workspace.getLeaf('tab');
        await leaf.openFile(file);
        if (hit.line !== undefined) {
          const view = leaf.view;
          if (view instanceof MarkdownView) view.editor.setCursor({line:hit.line,ch:0});
        }
      });
      await MarkdownRenderer.render(this.app, hit.content, block.createDiv(), hit.path, this);
    }
  }
}

export default class DayAggregate extends Plugin {
  settings: Settings = DEFAULT;
  selectedDay: string | null = null;
  get locale(): 'en' | 'de' {
    if (this.settings.language !== 'auto') return this.settings.language;
    return moment.locale().toLowerCase().startsWith('de') ? 'de' : 'en';
  }
  t(key: MessageKey): string { return MESSAGES[this.locale][key]; }
  refreshViews() {
    this.refreshCalendars();
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW)) {
      const view = leaf.view;
      if (view instanceof DayView) void view.render();
    }
  }
  refreshCalendars() {
    for (const leaf of this.app.workspace.getLeavesOfType(CALENDAR_VIEW)) {
      const view = leaf.view;
      if (view instanceof CalendarView) view.render();
    }
  }
  async onload() {
    this.settings = Object.assign({}, DEFAULT, await this.loadData());
    this.registerView(VIEW, leaf => new DayView(leaf, this));
    this.registerView(CALENDAR_VIEW, leaf => new CalendarView(leaf, this));
    this.addCommand({id:'open-calendar',name:this.t('openCalendarWithSummary'),callback:()=>this.openCalendar()});
    this.addCommand({id:'open-day',name:this.t('openDayOverview'),callback:()=>this.promptDate()});
    this.addCommand({id:'open-today',name:this.t('openTodayOverview'),callback:()=>this.openDay(moment().format(this.settings.dateFormat))});
    this.addRibbonIcon('calendar-days',this.t('openCalendar'),()=>this.openCalendar());
    this.addSettingTab(new AggregateSettings(this.app,this));
  }
  async openCalendar() {
    let leaf = this.app.workspace.getLeavesOfType(CALENDAR_VIEW)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf('tab');
      await leaf.setViewState({type:CALENDAR_VIEW,active:true});
    }
    await this.app.workspace.revealLeaf(leaf);
  }
  async promptDate() {
    const input = window.prompt(`${this.t('datePrompt')} (${this.settings.dateFormat})`, moment().format(this.settings.dateFormat));
    if (input === null) return;
    const parsed = moment(input, this.settings.dateFormat, true);
    if (!parsed.isValid()) { new Notice(this.t('invalidDate')); return; }
    await this.openDay(parsed.format(this.settings.dateFormat));
  }
  async openDay(day: string) {
    this.selectedDay = day;
    this.refreshCalendars();
    if (this.settings.materialize) {
      const parsed = moment(day, this.settings.dateFormat, true);
      const path = `${this.settings.outputFolder.replace(/^\/+|\/+$/g,'')}/${parsed.format('YYYY')}/${parsed.format('MM')}/${parsed.format('YYYY-MM-DD')}.md`;
      const text = await this.markdown(day);
      const folder = path.substring(0,path.lastIndexOf('/'));
      if (!this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder.split('/')[0]).catch(()=>{});
      let current='';
      for(const part of folder.split('/')) { current=current?`${current}/${part}`:part; if(!this.app.vault.getAbstractFileByPath(current)) await this.app.vault.createFolder(current); }
      const existing=this.app.vault.getAbstractFileByPath(path);
      if(existing instanceof TFile) await this.app.vault.modify(existing,text);
      else await this.app.vault.create(path,text);
      await this.app.workspace.getLeaf('tab').openFile(this.app.vault.getAbstractFileByPath(path) as TFile);
      return;
    }
    let leaf=this.app.workspace.getLeavesOfType(VIEW)[0];
    if(!leaf) {leaf=this.app.workspace.getLeaf('tab'); await leaf.setViewState({type:VIEW,active:true});}
    const view=leaf.view as DayView;
    view.day=day;
    await view.render();
    this.app.workspace.revealLeaf(leaf);
  }
  async collect(day:string):Promise<Hit[]> {
    const hits:Hit[]=[];
    const files=this.app.vault.getMarkdownFiles();
    const output=this.settings.outputFolder.replace(/^\/+|\/+$/g,'');
    for(const file of files) {
      if(output && (file.path===output || file.path.startsWith(output+'/'))) continue;
      const isDated=file.basename===day;
      const cache=this.app.metadataCache.getFileCache(file);
      const headings=(cache?.headings??[]).filter(h=>h.heading.trim()===day).sort((a,b)=>a.position.start.line-b.position.start.line);
      if(!isDated && !headings.length) continue;
      const content=await this.app.vault.cachedRead(file);
      const lines=content.split(/\r?\n/);
      if(isDated) { hits.push({path:file.path,kind:'note',content}); continue; }
      for(const h of headings) {
        const start=h.position.start.line;
        const next=(cache?.headings??[]).filter(x=>x.position.start.line>start && x.level<=h.level).sort((a,b)=>a.position.start.line-b.position.start.line)[0];
        const end=next?next.position.start.line:lines.length;
        hits.push({path:file.path,line:start,kind:'heading',content:lines.slice(start,end).join('\n').trimEnd()});
      }
    }
    return hits.sort((a,b)=>a.path.localeCompare(b.path)||((a.line??-1)-(b.line??-1)));
  }
  async markdown(day:string) {
    const hits=await this.collect(day);
    return `# ${this.t('dayOverview')} ${day}\n\n`+(hits.length?hits.map(h=>`> ${this.t('source')}: [[${h.path}${h.line!==undefined?`#${day}`:''}|${h.path}${h.line!==undefined?`:${h.line+1}`:''}]]\n\n${h.content}\n`).join('\n---\n\n'):`${this.t('noMatches')}\n`);
  }
}

class CalendarView extends ItemView {
  plugin: DayAggregate;
  month = moment().startOf('month');
  constructor(leaf: WorkspaceLeaf, plugin: DayAggregate) { super(leaf); this.plugin=plugin; }
  getViewType() { return CALENDAR_VIEW; }
  getDisplayText() { return this.plugin.t('calendar'); }
  getIcon() { return 'calendar-days'; }
  async onOpen() { this.render(); }
  render() {
    const root=this.contentEl; root.empty(); root.addClass('aggregate-calendar');
    const bar=root.createDiv({cls:'aggregate-calendar-toolbar'});
    const prev=bar.createEl('button',{text:'‹',attr:{'aria-label':this.plugin.t('previousMonth')}});
    prev.addEventListener('click',()=>{this.month.subtract(1,'month');this.render();});
    bar.createEl('strong',{text:this.month.format('MMMM YYYY')});
    const next=bar.createEl('button',{text:'›',attr:{'aria-label':this.plugin.t('nextMonth')}});
    next.addEventListener('click',()=>{this.month.add(1,'month');this.render();});
    const today=bar.createEl('button',{text:this.plugin.t('today')});
    today.addEventListener('click',()=>{this.month=moment().startOf('month');this.render();});
    const grid=root.createDiv({cls:'aggregate-calendar-grid'});
    for(const name of MESSAGES[this.plugin.locale].weekdays) grid.createEl('span',{text:name,cls:'aggregate-calendar-weekday'});
    const offset=this.month.isoWeekday()-1;
    const days=this.month.daysInMonth();
    for(let i=0;i<offset;i++) grid.createEl('span');
    for(let d=1;d<=days;d++) {
      const date=this.month.clone().date(d);
      const btn=grid.createEl('button',{text:String(d),attr:{'aria-label':date.format('YYYY-MM-DD')}});
      if(date.isSame(moment(),'day')) btn.addClass('is-today');
      const selected = this.plugin.selectedDay && date.isSame(moment(this.plugin.selectedDay, this.plugin.settings.dateFormat, true), 'day');
      if (selected) { btn.addClass('is-selected'); btn.setAttribute('aria-pressed', 'true'); }
      else btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click',()=>void this.plugin.openDay(date.format(this.plugin.settings.dateFormat)));
    }
  }
}

class AggregateSettings extends PluginSettingTab {
  plugin:DayAggregate;
  constructor(app:App,plugin:DayAggregate){super(app,plugin);this.plugin=plugin;}
  display(){this.containerEl.empty();
    new Setting(this.containerEl).setName(this.plugin.t('language')).setDesc(this.plugin.t('languageDesc')).addDropdown(d=>d
      .addOption('auto','Auto / Automatisch').addOption('en','English').addOption('de','Deutsch')
      .setValue(this.plugin.settings.language).onChange(async v=>{
        this.plugin.settings.language=v as Language;
        await this.plugin.saveData(this.plugin.settings);
        this.plugin.refreshViews();
        this.display();
        new Notice(this.plugin.locale==='de'?'Befehlsnamen werden nach einem Neustart aktualisiert.':'Command names update after restarting Obsidian.');
      }));
    new Setting(this.containerEl).setName(this.plugin.t('dateFormat')).setDesc(this.plugin.t('dateFormatDesc')).addText(t=>t.setValue(this.plugin.settings.dateFormat).onChange(async v=>{this.plugin.settings.dateFormat=v;await this.plugin.saveData(this.plugin.settings)}));
    new Setting(this.containerEl).setName(this.plugin.t('materialize')).setDesc(this.plugin.t('materializeDesc')).addToggle(t=>t.setValue(this.plugin.settings.materialize).onChange(async v=>{this.plugin.settings.materialize=v;await this.plugin.saveData(this.plugin.settings)}));
    new Setting(this.containerEl).setName(this.plugin.t('outputFolder')).addText(t=>t.setValue(this.plugin.settings.outputFolder).onChange(async v=>{this.plugin.settings.outputFolder=v;await this.plugin.saveData(this.plugin.settings)}));
  }
}
