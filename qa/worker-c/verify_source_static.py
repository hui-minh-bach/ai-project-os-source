"""Source-bound checks, NOT a substitute for browser/signed installer/Windows QA."""
from pathlib import Path
import re, unittest
ROOT=Path(__file__).resolve().parents[2]
class WorkerCSource(unittest.TestCase):
 def test_ten_tabs_and_five_themes(self):
  html=(ROOT/'public/index.html').read_text()
  keys=re.findall(r'<button class="nav(?: active)?" data-page="([a-z-]+)"',html)
  self.assertEqual(keys,['home','connections','idea','council','team','skills','engines','map','publish','guide'])
  for value in ('ocean','emerald','aurora','arctic','amber'):
   self.assertIn(f'value="{value}"',html)
 def test_boot_is_resilient(self):
  init=(ROOT/'public/init.js').read_text()
  for name in ('vaultRefresh','loadConnections','loadSkills','loadEngines','loadPrereq','loadProjects'):
   self.assertIn(name,init)
  self.assertIn('catch(error)',init)
  self.assertIn('customerShowFailure',init)
 def test_error_ui_and_next_step(self):
  html=(ROOT/'public/index.html').read_text()
  self.assertIn('id="customerRetry"',html)
  self.assertIn('role="alert"',html)
  self.assertIn('aria-modal="true"',html)
  home=(ROOT/'public/tabs/home.html').read_text()
  self.assertIn('id="homeCurrentProject"',home)
  self.assertIn('homeNextAction', (ROOT/'public/tabs/home.js').read_text())
 def test_installer_keeps_data_out(self):
  script=(ROOT/'windows/Build-WorkerC-Internal-RC.ps1').read_text()
  iss=(ROOT/'windows/WorkerC-Internal-RC.iss').read_text()
  self.assertIn('Get-FileHash',script)
  self.assertIn('runtime-win-x64',script)
  self.assertIn("'backups'",script)
  self.assertNotIn('[UninstallDelete]',iss.split('[Icons]')[0].split('[Files]')[-1])
  self.assertIn('PrivilegesRequired=lowest',iss)
 def test_launcher_root_and_collision(self):
  launcher=(ROOT/'src/launcher.mjs').read_text()
  self.assertIn('cwd:ROOT',launcher)
  self.assertIn('portOccupied(candidate)',launcher)
  self.assertIn('readLocalSessionTicket',launcher)
if __name__=='__main__':unittest.main(verbosity=2)
