import fs from 'fs';

const list = JSON.parse(fs.readFileSync('docs/extracted_strings.json', 'utf8'));

// Look for strings around onboarding questions / statements
const introQuestions = list.filter(s => 
  s.includes('?') || 
  s.includes('Money') || 
  s.includes('Track') || 
  s.includes('Rolly') ||
  s.includes('Assistant') ||
  s.includes('AI')
);

console.log('Potential onboarding/headline strings:');
console.log(introQuestions.slice(0, 40));
