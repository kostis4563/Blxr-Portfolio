import { navigate, projectPath, libraryPath, HOME_PATH, PROJECTS_PATH, LIBRARY_PATH } from './router'
import { projectsList, SHORT_KEY } from './projects'
import { libraryList } from './library'
import { SECTIONS, jumpToSection } from './palette'
import { fold } from './text-match'
import { CONTACT_EMAIL, SOCIALS } from './profile'

export function buildCommands({ t, theme, toggleTheme }) {
  const jump = t('cmd.group.jump')
  const actions = t('cmd.group.actions')
  const links = t('cmd.group.links')
  const projects = t('home.projects')

  const commands = [
    {
      id: 'page-home',
      group: jump,
      label: t('cmd.home'),
      icon: 'home',
      href: HOME_PATH,
      run: () => navigate(HOME_PATH),
    },
    {
      id: 'page-projects',
      group: jump,
      label: t('proj.archiveTitle'),
      hint: t('home.projectsCount', { n: projectsList.length }),
      icon: 'archive',
      href: PROJECTS_PATH,
      run: () => navigate(PROJECTS_PATH),
    },
    {
      id: 'page-library',
      group: jump,
      label: t('lib.title'),
      hint: t('lib.count', { n: libraryList.length }),
      icon: 'archive',
      href: LIBRARY_PATH,
      run: () => navigate(LIBRARY_PATH),
      keywords: 'fivem library ui script hud nui lua',
    },

    ...SECTIONS.map((section) => ({
      id: `section-${section.id}`,
      group: jump,
      label: t(section.key),
      icon: 'section',
      href: `${HOME_PATH}#${section.id}`,
      run: () => jumpToSection(section.id),
    })),

    ...projectsList.map((project) => ({
      id: `project-${project.id}`,
      group: projects,
      label: project.title,
      hint: t(`cat.${project.category}`, null, project.category),
      icon: 'project',
      href: projectPath(project.id),
      run: () => navigate(projectPath(project.id)),

      keywords: `${project.tags.join(' ')} ${t(SHORT_KEY[project.id], null, project.shortDescription)}`,
    })),

    ...libraryList
      .filter((entry) => !entry.placeholder)
      .map((entry) => ({
        id: `library-${entry.id}`,
        group: t('lib.title'),
        label: entry.title,
        hint: t(`cat.${entry.category}`, null, entry.category),
        icon: 'project',
        href: libraryPath(entry.id),
        run: () => navigate(libraryPath(entry.id)),
        keywords: `fivem ${entry.tags.join(' ')} ${entry.shortDescription}`,
      })),

    {
      id: 'action-theme',
      group: actions,

      label: theme === 'dark' ? t('cmd.themeLight') : t('cmd.themeDark'),
      icon: theme === 'dark' ? 'sun' : 'moon',
      run: toggleTheme,
      keywords: 'theme dark light',
    },
    {
      id: 'action-copy-email',
      group: actions,
      label: t('cmd.copyEmail'),
      hint: CONTACT_EMAIL,
      icon: 'copy',

      run: () => navigator.clipboard?.writeText(CONTACT_EMAIL).catch(() => {}),
      flash: t('contact.copied'),
    },

    ...SOCIALS.filter((social) => social.url).map((social) => ({
      id: `link-${social.name.toLowerCase()}`,
      group: links,
      label: social.name,
      hint: social.handle,
      icon: social.name.toLowerCase(),
      href: social.url,
      external: true,
    })),
    {
      id: 'link-email',
      group: links,
      label: t('cmd.sendEmail'),
      hint: CONTACT_EMAIL,
      icon: 'mail',
      href: `mailto:${CONTACT_EMAIL}`,
      external: true,
    },
  ]

  return commands.map((command) => ({
    ...command,
    fLabel: fold(command.label),
    haystack: fold([command.label, command.hint || '', command.group, command.keywords || ''].join(' ')),
  }))
}

export function rankCommands(commands, query) {
  const q = fold(query.trim())
  if (!q) return commands

  const hits = []
  for (const command of commands) {
    if (command.fLabel.startsWith(q)) hits.push({ command, rank: 0 })
    else if (command.fLabel.includes(q)) hits.push({ command, rank: 1 })
    else if (command.haystack.includes(q)) hits.push({ command, rank: 2 })
  }
  return hits.sort((a, b) => a.rank - b.rank).map((hit) => hit.command)
}

export function groupCommands(commands) {
  const byName = new Map()
  for (const command of commands) {
    const items = byName.get(command.group)
    if (items) items.push(command)
    else byName.set(command.group, [command])
  }
  return [...byName].map(([name, items]) => ({ name, items }))
}
