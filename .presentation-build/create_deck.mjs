import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Presentation, PresentationFile } from '@oai/artifact-tool';
import { resolvePresentationFont, applyPresentationChartFont } from '/Users/krrishparmar/.codex/plugins/cache/openai-primary-runtime/presentations/26.1024.11018/skills/presentations/container_tools/artifact_tool_utils.mjs';

const workspaceDir = '/Users/krrishparmar/movie-rating-analysis';
const buildDir = path.join(workspaceDir, '.presentation-build');
const outputDir = path.join(workspaceDir, 'presentation');
const finalPath = path.join(outputDir, 'Movie-Rating-Analysis-Final.pptx');
const font = resolvePresentationFont({ fontFamily: 'Aptos' });
const C = { navy:'#12243A', ink:'#17324D', muted:'#526779', teal:'#168C8C', line:'#D7E1E7', white:'#FFFFFF', bg:'#FBFCFD' };
const ppt = Presentation.create({ slideSize: { width: 1280, height: 720 } });
ppt.theme.defaultFont = font;

function text(slide, value, left, top, width, height, style={}) {
  const box = slide.shapes.add({ geometry:'textbox', position:{left,top,width,height}, fill:'none', line:{style:'solid',fill:'none',width:0} });
  box.text = value;
  box.text.style = { typeface:font, fontSize:25, color:C.ink, wrap:'square', autoFit:'shrinkText', insets:0, verticalAlignment:'top', ...style };
  return box;
}
function slide(title) {
  const s = ppt.slides.add(); s.background.fill = C.bg;
  text(s,title,68,46,1135,58,{fontSize:45,bold:true,color:C.navy}); return s;
}
function notes(s, value) { s.speakerNotes.text = value; s.speakerNotes.setVisible(true); }
function styleChart(ch) { applyPresentationChartFont(ch,{fontFamily:font}); return ch; }

// 1. Title
{
  const s=ppt.slides.add(); s.background.fill=C.navy;
  text(s,'Movie Rating Analysis',78,210,1090,90,{fontSize:64,bold:true,color:C.white});
  text(s,'MovieLens 20M  |  PySpark  |  Cassandra',82,323,1000,50,{fontSize:29,color:'#A8DADC'});
  text(s,'A data project about how people rate movies',82,405,900,54,{fontSize:26,color:C.white});
  notes(s,'Hello. My project analyzes the MovieLens 20M movie ratings dataset. I used PySpark to calculate summaries, Cassandra to store them, and charts to explain the results.');
}
// 2. Goal
{
  const s=slide('Project goal');
  text(s,'How can we summarize more than 20 million movie ratings?',74,150,1080,100,{fontSize:40,bold:true,color:C.teal});
  text(s,'I calculated four views of the data:',76,284,900,40,{fontSize:26,bold:true});
  text(s,'Average rating and rating count for each movie\nAverage rating and count for each genre\nHow often each score appears\nAverage rating and rating count by release year',92,344,1030,220,{fontSize:27,color:C.ink,lineSpacing:1.15});
  notes(s,'The goal was to turn a large collection of individual ratings into useful summaries. I focused on four questions: which movies have how many ratings, how genres compare, which scores are most common, and how average ratings vary by release year.');
}
// 3. Dataset
{
  const s=slide('Dataset');
  const cols=[78,465,850], stats=[['20,000,263','ratings in rating.csv'],['27,278','movies in movie.csv'],['0.5 to 5.0','rating scale']];
  stats.forEach((v,i)=>{text(s,v[0],cols[i],165,340,70,{fontSize:46,bold:true,color:C.teal});text(s,v[1],cols[i],236,340,45,{fontSize:22,color:C.muted});});
  text(s,'Rating records include a user, a movie, a score, and a timestamp.',78,355,1090,55,{fontSize:27,bold:true});
  text(s,'Movie records add each title and its genre labels. The dataset contains 19 listed genres.',78,427,1090,80,{fontSize:25,color:C.muted});
  notes(s,'The input files are movie.csv and rating.csv. The ratings file has 20,000,263 data rows. The movie file has 27,278 movies. Ratings use half-star increments from 0.5 to 5.0. The movie file also supplies a title and one or more genres for each movie. Source: the MovieLens 20M files included with this project.');
}
// 4. Workflow
{
  const s=slide('Analysis workflow');
  const steps=[['01','Read the CSV files','Spark reads movie details and ratings.'],['02','Calculate summaries','Group ratings by movie, genre, score, and year.'],['03','Save the results','Export summary CSVs and insert rows into Cassandra.'],['04','Check the output','Create charts and compare Cassandra row counts.']];
  steps.forEach((v,i)=>{const y=148+i*120;text(s,v[0],82,y,80,52,{fontSize:31,bold:true,color:C.teal});text(s,v[1],188,y,420,42,{fontSize:28,bold:true});text(s,v[2],608,y+2,560,62,{fontSize:23,color:C.muted});});
  notes(s,'First, Spark reads the two CSV files. Then it calculates four summaries. I save each summary as a CSV file and load the same rows into Cassandra. The program also creates charts and checks how many rows each Cassandra table contains.');
}
// Shared chart colors and axis text
const axisStyle={fill:C.muted,fontSize:14,typeface:font};
const grid={style:'solid',fill:C.line,width:1};
// 5. Rating distribution
{
  const s=slide('Most ratings were 4 stars');
  const ch=styleChart(s.charts.add('bar',{position:{left:72,top:142,width:825,height:500},categories:['0.5','1.0','1.5','2.0','2.5','3.0','3.5','4.0','4.5','5.0'],series:[{name:'Ratings (millions)',values:[0.239125,0.680732,0.279252,1.430997,0.883398,4.291193,2.200156,5.561926,1.534824,2.898660],fill:C.teal}],barOptions:{direction:'column',grouping:'clustered',gapWidth:50},hasLegend:false,xAxis:{title:{text:'Rating score'},textStyle:axisStyle,line:{style:'solid',fill:C.line,width:1},majorGridlines:null},yAxis:{title:{text:'Number of ratings (millions)'},min:0,max:6,majorUnit:1,numberFormatCode:'0.0',textStyle:axisStyle,majorGridlines:grid},chartFill:'none',chartLine:{style:'solid',fill:'none',width:0},plotAreaFill:'none',plotAreaLine:{style:'solid',fill:'none',width:0}}));
  text(s,'5.56 million',930,228,286,54,{fontSize:34,bold:true,color:C.teal});
  text(s,'4.0-star ratings',930,282,286,42,{fontSize:24,bold:true});
  text(s,'That is about 27.8% of all ratings. The next most common score was 3.0 stars.',930,356,280,150,{fontSize:22,color:C.muted});
  notes(s,'The most common score was 4.0 stars, with 5,561,926 ratings. That is about 27.8 percent of all 20,000,263 ratings. The next most common score was 3.0 stars, with about 4.29 million ratings. These are counts, so they show how often each score was given.');
}
// 6. Genre averages
{
  const s=slide('Genre averages vary');
  const genres=[['Horror',3.2772],['Comedy',3.4260],['Action',3.4439],['Children',3.4081],['Adventure',3.5019],['Thriller',3.5071],['Fantasy',3.5059],['Romance',3.5418],['Musical',3.5581],['Western',3.5705],['Animation',3.6175],['Mystery',3.6635],['IMAX',3.6559],['Drama',3.6743],['Crime',3.6745],['Documentary',3.7397],['War',3.8095],['Film-Noir',3.9654],['Sci-Fi',3.4368]].sort((a,b)=>a[1]-b[1]);
  const ch=styleChart(s.charts.add('bar',{position:{left:68,top:132,width:820,height:520},categories:genres.map(g=>g[0]),series:[{name:'Average rating',values:genres.map(g=>g[1]),fill:C.teal}],barOptions:{direction:'bar',grouping:'clustered',gapWidth:36},hasLegend:false,xAxis:{title:{text:'Genre'},textStyle:{...axisStyle,fontSize:13},line:{style:'solid',fill:C.line,width:1},majorGridlines:null},yAxis:{title:{text:'Average rating on a 0 to 5 scale'},min:0,max:5,majorUnit:1,textStyle:{...axisStyle,fontSize:13},majorGridlines:grid},chartFill:'none',chartLine:{style:'solid',fill:'none',width:0},plotAreaFill:'none',plotAreaLine:{style:'solid',fill:'none',width:0}}));
  text(s,'Highest average',930,208,280,38,{fontSize:21,bold:true,color:C.muted});
  text(s,'Film-Noir  3.97',930,250,280,46,{fontSize:28,bold:true,color:C.teal});
  text(s,'216,689 ratings',930,300,280,36,{fontSize:20,color:C.muted});
  text(s,'Drama had the most ratings: 8,857,853.',930,388,280,100,{fontSize:22,bold:true,color:C.ink});
  notes(s,'This chart compares average ratings for all 19 genres. Film-Noir had the highest average, about 3.97, based on 216,689 ratings. Drama had the most ratings, with 8,857,853. A high average and a high number of ratings measure different things, so I report both.');
}
// 7. Release year
{
  const s=slide('Average ratings by release year, 1990–2014');
  const years=[[1990,3.4097],[1991,3.5776],[1992,3.4393],[1993,3.5004],[1994,3.4865],[1995,3.4473],[1996,3.3518],[1997,3.3769],[1998,3.4295],[1999,3.4784],[2000,3.4129],[2001,3.4793],[2002,3.4702],[2003,3.4852],[2004,3.5379],[2005,3.4758],[2006,3.5672],[2007,3.5431],[2008,3.5533],[2009,3.5549],[2010,3.6007],[2011,3.5195],[2012,3.5887],[2013,3.4910],[2014,3.5245]];
  const labels=years.map(([y])=>String(y));
  const ch=styleChart(s.charts.add('line',{position:{left:68,top:143,width:835,height:480},categories:labels,series:[{name:'Average rating',values:years.map(y=>y[1]),line:{style:'solid',fill:C.teal,width:3},marker:{symbol:'circle',size:5,fill:C.teal}}],hasLegend:false,xAxis:{title:{text:'Movie release year'},textStyle:{...axisStyle,fontSize:12},line:{style:'solid',fill:C.line,width:1},majorGridlines:null},yAxis:{title:{text:'Average rating on a 0 to 5 scale'},min:0,max:5,majorUnit:1,textStyle:axisStyle,majorGridlines:grid},chartFill:'none',chartLine:{style:'solid',fill:'none',width:0},plotAreaFill:'none',plotAreaLine:{style:'solid',fill:'none',width:0}}));
  text(s,'3.35 to 3.60',935,226,280,52,{fontSize:32,bold:true,color:C.teal});
  text(s,'Average rating range across these years',935,282,270,74,{fontSize:21,color:C.muted});
  text(s,'The 2015 release-year group had 996 ratings, so it is not shown here.',935,392,270,120,{fontSize:20,color:C.muted});
  notes(s,'The chart shows average rating by release year from 1990 through 2014. The values range from 3.35 in 1996 to 3.60 in 2010. I left 2015 off this chart because that year has only 996 ratings in this dataset, far fewer than the preceding years. The chart describes the data and does not show that release year caused a rating.');
}
// 8. Cassandra table
{
  const s=slide('Cassandra stores four summaries');
  const t=s.tables.add({rows:5,columns:3,left:72,top:160,width:1136,height:390,values:[['Table','Rows loaded','What each row represents'],['movie_stats','27,278','One movie'],['genre_stats','19','One genre'],['rating_distribution','10','One rating score'],['yearly_stats','118','One release year']]});
  t.styleOptions={headerRow:true,bandedRows:true}; t.borders.assign({style:'solid',fill:C.line,width:1});
  for(let c=0;c<3;c++) t.getCell(0,c).fill=C.navy;
  t.cells.block({row:0,column:0,rowCount:1,columnCount:3}).textStyle.bold=true;
  t.cells.block({row:0,column:0,rowCount:5,columnCount:3}).textStyle.fontSize=21;
  t.cells.block({row:0,column:0,rowCount:1,columnCount:3}).textStyle.color=C.white;
  text(s,'The same summaries are also saved as CSV files for review and submission.',74,590,1090,55,{fontSize:23,color:C.muted});
  notes(s,'Cassandra contains one table for each summary. I loaded 27,278 movie rows, 19 genre rows, 10 rating score rows, and 118 release-year rows. The script checked each table after loading, and the counts matched the summary files.');
}
// 9. Conclusion
{
  const s=slide('Main findings and limits');
  text(s,'What the analysis shows',76,147,500,42,{fontSize:27,bold:true,color:C.teal});
  text(s,'4.0 stars was the most common score.\nFilm-Noir had the highest genre average.\nDrama received the most ratings.',78,205,515,182,{fontSize:25,color:C.ink});
  text(s,'What the analysis cannot show',660,147,540,42,{fontSize:27,bold:true,color:C.teal});
  text(s,'Averages do not explain why someone liked a movie.\nGenres have different numbers of ratings.\nA high average can come from fewer ratings.',662,205,540,210,{fontSize:24,color:C.ink});
  text(s,'Thank you',78,500,450,64,{fontSize:40,bold:true,color:C.navy});
  notes(s,'To conclude, 4.0 stars was the most common rating. Film-Noir had the highest average, while Drama had the most ratings. This analysis summarizes patterns but cannot tell us why a person gave a score. Genre averages also need context because the genres have different numbers of ratings. Thank you. I am ready for questions.');
}

await fs.mkdir(buildDir,{recursive:true});
await fs.mkdir(outputDir,{recursive:true});
for(let i=0;i<ppt.slides.items.length;i++) {
  const png=await ppt.export({slide:ppt.slides.items[i],format:'png',scale:1});
  await fs.writeFile(path.join(buildDir,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));
}
const draft=path.join(buildDir,'candidate.pptx');
await (await PresentationFile.exportPptx(ppt)).save(draft);
const {finalizePresentation}=await import(pathToFileURL(path.join('/Users/krrishparmar/.codex/plugins/cache/openai-primary-runtime/presentations/26.1024.11018/skills/presentations/container_tools/artifact_tool_utils.mjs')).href);
const result=await finalizePresentation({
  explicitTotalSlideCount:9,
  requiredNativeTableOwnerSlides:[8],
  requiredNativeChartOwnerSlides:[5,6,7],
  materializeLiteralChartWorkbooks:true,
  workspaceDir,
  candidatePath:draft,
  finalPath,
  pythonExecutable:'/Users/krrishparmar/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',
  integrityValidatorPath:'/Users/krrishparmar/.codex/plugins/cache/openai-primary-runtime/presentations/26.1024.11018/skills/presentations/container_tools/inspect_presentation_package_integrity.py',
  layoutValidatorPath:'/Users/krrishparmar/.codex/plugins/cache/openai-primary-runtime/presentations/26.1024.11018/skills/presentations/container_tools/inspect_presentation_layout_geometry.py',
  layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit','--require-native-table-slide','8'],
  fontPolicy:{basis:'design',families:[font]},
  verifyArtifactToolImport:true,
  receiptPath:path.join(buildDir,'Movie-Rating-Analysis-Final.validation.json'),
});
console.log(JSON.stringify({finalPath,result}));
