import fs from 'fs';
import rndUseragent from 'random-useragent';
import * as puppeteer from 'puppeteer';
import parse, { HTMLElement } from 'node-html-parser';
import { Telegraf } from 'telegraf';
import * as cheerio from 'cheerio';
import table_parse from 'cheerio-tableparser';
import { setIntervalAsync, SetIntervalAsyncTimer, clearIntervalAsync } from 'set-interval-async';
//import { clearIntervalAsync } from 'set-interval-async/dist/clear-interval-async.cjs';


interface Config {
    legajo: string;
    password: string;
    especialidad: string;
    token: string;
    frecuencia: number;
}

interface Materia {
    id: string;
    name: string;
    notas: string[];
}


class Botnotas {

    private config: Config;    
    private cookies: puppeteer.Protocol.Network.CookieParam[] = [];
    private materias: Materia[] = [];
    private log_stream: fs.WriteStream;
    private chats: number[] = [];

    public bot_telegram: Telegraf;

    private readonly LOGIN_URL = 'https://www.frc.utn.edu.ar/logon.frc';
    private readonly A4_URL = 'https://a4.frc.utn.edu.ar/4/default.jsp';
    

    private constructor() {
        this.log_stream = fs.createWriteStream('history.log', {flags:'a'});
        this.log('--- Inicializando bot...');

        if (fs.existsSync('cookies.json')) {
            this.cookies = JSON.parse(fs.readFileSync('cookies.json', 'utf8'));
        } else {
            fs.writeFileSync('cookies.json', JSON.stringify([]));
        }

        if (fs.existsSync('chats.json')) {
            this.chats = JSON.parse(fs.readFileSync('chats.json', 'utf8'));
        } else {
            fs.writeFileSync('chats.json', JSON.stringify([]));
        }

        const config_template = {
            legajo: '<legajo>',
            password: '<contraseña>',
            especialidad: '<carrera/servidor>',
            token: '<token bot telegram>',
            frecuencia: 60
        };

        if (fs.existsSync('config.json')) {
            this.config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

            if (JSON.stringify(this.config) === JSON.stringify(config_template)) {
                this.log('Completa el archivo "config.json"');
                process.exit(1);
            }

            // init bot
            this.bot_telegram = new Telegraf(this.config.token);

        } else {
            this.config = { ...config_template };
            this.save_config();

            this.log('Completa el archivo "config.json"');
            process.exit(1);
        }
    }


    // CONSTRUCTOR
    public static async new_bot(): Promise<Botnotas> {
        const botnotas = new Botnotas();
        await botnotas.load_materias(false);

        botnotas.log('--- BOT inicializado ---');
        return botnotas;
    }


    private save_config() {
        fs.writeFileSync('config.json', JSON.stringify(this.config, null, 4));
    }

    public get_frecuencia(): number {
        return this.config.frecuencia * 60 * 1000;
    }

    public set_frecuencia(freq: number) {
        this.config.frecuencia = freq;
        this.save_config();
    }

    public add_chat(id: number) {
        this.chats.push(id);
        fs.writeFileSync('chats.json', JSON.stringify(this.chats));
    }

    private log(event: string) {
        const log_str = `[${(new Date()).toLocaleString()}] ${event}\n`;
        console.log(log_str);
        this.log_stream.write(log_str);
    }


    private async start_session(url: string): Promise<puppeteer.Page | null> {
        this.log('Intentando ingresar a ' + url);

        const user_agent = rndUseragent.getRandom(ua => {return ua.browserName === 'Firefox'})!;
        const browser = await puppeteer.launch({
            headless: true,         // Mostrar o no
            ignoreHTTPSErrors: true
        });

        const page = await browser.newPage();
        await page.setUserAgent(user_agent);
        await page.setViewport({width: 1920, height: 1080});
        await page.setCookie(... this.cookies);

        const res = await page.goto(url);

        if (res?.status() !== 200) return null;

        if (page.url() !== url) {   // Chequear si caduco la sesion
            this.log('Sesion expirada!');
            const cookie = await this.login(page);
            await page.waitForTimeout(1500);

            await page.setCookie(... cookie);

            await page.waitForTimeout(1500);
            const res = await page.goto(url);
            await page.waitForTimeout(1500);
            await page.waitForNetworkIdle({timeout: 5000});

            if (res?.status() !== 200) return null;
        }

        this.log('Se Ingreso a ' + url);
        return page;
    }


    private async login(_page: puppeteer.Page): Promise<puppeteer.Protocol.Network.CookieParam[]> {
        const page = await _page.browser().newPage(); 

        this.log('Iniciando sesion...');
        await page.goto(this.LOGIN_URL);

        const input_user = await page.waitForSelector('#txtUsuario');
        const input_pass = await page.waitForSelector('#pwdClave');

        await input_user?.type(this.config.legajo);
        await input_pass?.type(this.config.password);
        await page.select('#txtDominios', this.config.especialidad);

        await page.click('#btnEnviar');

        const cookie = await page.cookies();
        this.cookies = cookie;
        fs.writeFile('cookies.json', JSON.stringify(this.cookies), e => {if (e) return console.error(e)});
        this.log('Sesion iniciada!');

        page.close();

        return cookie;
    }


    public async load_materias(force: boolean) {
        this.log('Obteniendo lista de materias...');
        if (fs.existsSync('materias.json') && !force) {
            this.log('Cargando de archivo...');
            this.materias = JSON.parse(fs.readFileSync('materias.json', 'utf8'));

            this.log('Lista de materias incriptas:');
            this.materias.forEach(m => this.log(`    ${m.id} --> ${m.name}`));
            return;
        }

        this.log('Cargando de Autogestion...');

        const autogestion = await this.start_session(this.A4_URL);
        if (autogestion === null) {
            this.log('--- Autogestion esta caido!!!, ejecuta de nuevo mas tarde!!! ---');
            process.exit(1);
        }

        const selector_materias = await autogestion.waitForSelector('#listaCursandoMaterias');
        const html_materias = await autogestion.evaluate(lista => lista.outerHTML, selector_materias);
        const list_materias = parse(html_materias);

        const materias: Materia[] = new Array();

        for (const child of list_materias.querySelector('#listaCursandoMaterias')?.childNodes!) {
            if (child instanceof HTMLElement) {
                materias.push({
                    id: child.id,
                    name: child.querySelector('a')?.firstChild.text.trim()!,
                    notas: []
                })
            }
        }

        this.materias = materias;
        this.materias = await this.load_notas(autogestion);  // Obtener las notas de cada materia

        fs.writeFile('materias.json', JSON.stringify(this.materias, null, 4), e => {if (e) return console.error(e)})
        
        this.log('Lista de materias incriptas:');
        this.materias.forEach(m => this.log(`    ${m.id} --> ${m.name}`));

        const browser = autogestion.browser();
        autogestion.close();
        browser.close();
    }


    private async load_notas(autogestion: puppeteer.Page): Promise<Materia[]> {
        this.log('Obteniendo notas de Autogestion...');
        const new_notas: Materia[] = new Array();

        for (const materia of this.materias) {
            const item_materia = await autogestion.waitForSelector(`#${materia.id}`);
            await item_materia?.$eval('i.fa-list-ol', btn => btn.click());  // abrir panel de notas  
            await autogestion.waitForNetworkIdle({timeout: 5000});

            const selector_tabla_notas = await autogestion.waitForSelector(`#${materia.id.replace('idCurso', 'tabla')}`); 
            await autogestion.waitForSelector(`#${materia.id.replace('idCurso', 'tabla')} > tbody > tr`);
            await autogestion.waitForTimeout(1500); // como para asegurarse, a veces le cuesta un poco a A4  

            const html_tabla_notas = await autogestion.evaluate(tabla => tabla.outerHTML, selector_tabla_notas);
            const tabla_notas = cheerio.load(html_tabla_notas); 
            table_parse(tabla_notas);

            const new_mat = { ...materia };
            new_mat.notas = ((tabla_notas('table > tbody') as any).parsetable(true, true, true)).map((e: Array<string>) => e[0]);
            new_notas.push(new_mat);
        }

        this.log('Notas obtenidas!');
        return new_notas;
    }

    
    public async check_and_update_notas() {
        this.log('--- Checkeando notas nuevas...');
        const autogestion = await this.start_session(this.A4_URL);
        if (autogestion === null) return;

        const new_notas = await this.load_notas(autogestion);

        const materias_cambiadas: Materia[] = new Array();

        for (let i = 0; i < this.materias.length; i++) {
            if (JSON.stringify(new_notas[i]) !== JSON.stringify(this.materias[i])) {
                materias_cambiadas.push(new_notas[i]);
            }
        }
        

        if (materias_cambiadas.length > 0) {
            this.materias = new_notas;
            fs.writeFile('materias.json', JSON.stringify(this.materias, null, 4), e => {if (e) return console.error(e)})

            const msg = `Nuevas notas!!!\n - ${(materias_cambiadas.map(m => m.name)).join('\n - ')}`;

            for (const chat of this.chats) {
                this.bot_telegram.telegram.sendMessage(chat, msg);
            }
        }

        this.log(`--- [${materias_cambiadas.length}] materias con notas nuevas:`);
        materias_cambiadas.forEach(m => this.log(`    ${m.name} --> ${m.notas}`));

        const browser = autogestion.browser();
        autogestion.close();
        browser.close();
    }
}

//////////////////////////////////////////////////////// MAIN
async function main() {
    const bot = await Botnotas.new_bot();
    const bot_telegram = bot.bot_telegram;

    let running = true;
    let bot_task: SetIntervalAsyncTimer<[]> | null = null;

    bot_telegram.command('test', ctx => {
        ctx.reply('OK');
    });

    bot_telegram.command('addme', ctx => {
        bot.add_chat(ctx.chat.id);
        ctx.reply('Chat agregado a lista de difusion');
    });

    bot_telegram.command('start', ctx => {
        if (!running) {
            running = true;
            bot_task = setIntervalAsync(bot.check_and_update_notas, bot.get_frecuencia());
            ctx.reply('Bot reactivado');
        } else {
            ctx.reply('El bot ya esta funcionando');
        }
    });

    bot_telegram.command('stop', ctx => {
        if (running) {
            running = false;
            clearIntervalAsync(bot_task!);
            ctx.reply('Bot desactivado');
        } else {
            ctx.reply('El bot ya esta parado');
        }
    });

    bot_telegram.command('status', ctx => {
        ctx.reply(`Bot activo: ${running}\nFrecuencia de chequeo: ${bot.get_frecuencia()/60/1000} mins.`);
    });

    bot_telegram.command('loadmats', ctx => {
        ctx.reply('Forzando recarga de materias');
        bot.load_materias(true);
    });
    
    bot_telegram.command('check', ctx => {
        ctx.reply('Forzando chequeo de notas');
        bot.check_and_update_notas();
    });

    bot_telegram.command('setfrec', ctx => {
        const args = ctx.update.message.text.split(' ');
        if (args.length > 1) {
            const frec = args[1];
            bot.set_frecuencia(parseInt(frec));
            ctx.reply(`Frecuencia de chequeo seteada a: ${frec} mins.`);
        }
    });


    bot_telegram.launch();
    bot_task = setIntervalAsync(async () => await bot.check_and_update_notas(), bot.get_frecuencia());
}

main();