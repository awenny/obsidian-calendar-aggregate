import esbuild from 'esbuild';
const prod=process.argv.includes('production');
const ctx=await esbuild.context({entryPoints:['src/main.ts'],bundle:true,external:['obsidian','electron','@codemirror/*','@lezer/*'],format:'cjs',target:'es2020',outfile:'main.js',logLevel:'info',minify:prod,sourcemap:prod?false:'inline'});
if(prod){await ctx.rebuild();await ctx.dispose()}else await ctx.watch();
