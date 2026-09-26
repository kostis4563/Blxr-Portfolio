import { navigate, projectPath, libraryPath, HOME_PATH, PROJECTS_PATH, LIBRARY_PATH, REVIEWS_PATH, WRITE_REVIEW_PATH, USES_PATH, CV_PATH, CONTACT_PATH, DASHBOARD_PATH, LOGIN_PATH, dashboardPath } from './router'
import { authSignOut, loginUrlFor } from './auth'
import { projectsList } from './projects'
import { libraryList } from './library'
import { SECTIONS, jumpToSection } from './palette'
import { fold } from './text-match'
import { CONTACT_EMAIL, SOCIALS } from './profile'
import { SITE_NAME } from './seo'

export function buildCommands({ theme, toggleTheme, signedIn = false }) {
  const jump = 'Jump to'
  const actions = 'Actions'
  const links = 'Links'
  const projects = 'Projects'

  const commands = [
    {
      id: 'page-home',
      group: jump,
      label: 'Home',
      icon: 'home',
      href: HOME_PATH,
      run: () => navigate(HOME_PATH),
    },
    {
      id: 'page-projects',
      group: jump,
      label: 'Projects Archive',
      hint: `${projectsList.length} projects`,
      icon: 'archive',
      href: PROJECTS_PATH,
      run: () => navigate(PROJECTS_PATH),
    },
    {
      id: 'page-library',
      group: jump,
      label: 'FiveM Library',
      hint: `${libraryList.length} resources`,
      icon: 'archive',
      href: LIBRARY_PATH,
      run: () => navigate(LIBRARY_PATH),
      keywords: 'fivem library ui script hud nui lua',
    },
    {
      id: 'page-reviews',
      group: jump,
      label: 'Reviews',
      hint: 'Feedback',
      icon: 'star',
      href: REVIEWS_PATH,
      run: () => navigate(REVIEWS_PATH),
      keywords: 'reviews testimonials feedback rating stars',
    },
    {
      id: 'page-uses',
      group: jump,
      label: 'Uses',
      hint: 'uses',
      icon: 'monitor',
      href: USES_PATH,
      run: () => navigate(USES_PATH),
      keywords: 'uses setup gear stack editor machine laptop terminal fonts hosting music tools software hardware',
    },
    {
      id: 'page-cv',
      group: jump,
      label: 'CV',
      hint: 'Curriculum vitae',
      icon: 'file',
      href: CV_PATH,
      run: () => navigate(CV_PATH),
      keywords: 'cv resume résumé curriculum vitae experience education skills certifications print pdf',
    },
    {
      id: 'page-contact',
      group: jump,
      label: 'Contact',
      hint: 'Get in touch',
      icon: 'mail',
      href: CONTACT_PATH,
      run: () => navigate(CONTACT_PATH),
      keywords: 'contact email reach hire freelance discord github socials',
    },

    ...SECTIONS.map((section) => ({
      id: `section-${section.id}`,
      group: jump,
      label: section.label,
      icon: 'section',
      href: `${HOME_PATH}#${section.id}`,
      run: () => jumpToSection(section.id),
    })),

    ...projectsList.map((project) => ({
      id: `project-${project.id}`,
      group: projects,
      label: project.title,
      hint: project.category,
      icon: 'project',
      href: projectPath(project.id),
      run: () => navigate(projectPath(project.id)),

      keywords: `${project.tags.join(' ')} ${project.shortDescription}`,
    })),

    ...libraryList
      .filter((entry) => !entry.placeholder)
      .map((entry) => ({
        id: `library-${entry.id}`,
        group: 'FiveM Library',
        label: entry.title,
        hint: entry.category,
        icon: 'project',
        href: libraryPath(entry.id),
        run: () => navigate(libraryPath(entry.id)),
        keywords: `fivem ${entry.tags.join(' ')} ${entry.shortDescription}`,
      })),

    {
      id: 'action-theme',
      group: actions,

      label: theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
      icon: theme === 'dark' ? 'sun' : 'moon',
      run: toggleTheme,
      keywords: 'theme dark light',
    },
    {
      id: 'action-write-review',
      group: actions,
      label: 'Write a review',
      icon: 'star',
      href: WRITE_REVIEW_PATH,
      run: () => navigate(WRITE_REVIEW_PATH),
      keywords: 'review testimonial feedback rate',
    },
    signedIn
      ? {
          id: 'page-dashboard',
          group: jump,
          label: 'Dashboard',
          icon: 'grid',
          href: DASHBOARD_PATH,
          run: () => navigate(DASHBOARD_PATH),
          keywords: 'dashboard account profile settings',
        }
      : {
          id: 'action-sign-in',
          group: actions,
          label: 'Sign in',
          hint: 'Or contact me through the dashboard',
          icon: 'user',
          href: loginUrlFor(DASHBOARD_PATH),
          run: () => navigate(loginUrlFor(DASHBOARD_PATH)),
          keywords: 'login sign in account register',
        },
    {
      id: 'action-send-message',
      group: actions,
      label: 'Send me a message',
      icon: 'message',
      href: dashboardPath('messages'),
      run: () => navigate(dashboardPath('messages')),
      keywords: 'contact message chat dm write talk',
    },
    signedIn && {
      id: 'action-sign-out',
      group: actions,
      label: 'Sign out',
      icon: 'logout',
      run: () => authSignOut().then(() => navigate(LOGIN_PATH, { replace: true })),
      keywords: 'logout sign out',
    },
    {
      id: 'action-copy-email',
      group: actions,
      label: 'Copy email address',
      hint: CONTACT_EMAIL,
      icon: 'copy',

      run: () => navigator.clipboard?.writeText(CONTACT_EMAIL).catch(() => {}),
      flash: 'Copied',
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
      label: 'Send an email',
      hint: CONTACT_EMAIL,
      icon: 'mail',
      href: `mailto:${CONTACT_EMAIL}`,
      external: true,
    },
  ]

  return commands.filter(Boolean).map((command) => ({
    ...command,
    fLabel: fold(command.label),
    haystack: fold([command.label, command.hint || '', command.group, command.keywords || ''].join(' ')),
  }))
}

export function sudoCommand(query) {
  const typed = query.trim().replace(/\s+/g, ' ')
  if (!/^sudo\b/i.test(typed)) return null
  return {
    id: 'action-sudo',
    group: 'Terminal',
    label: /^sudo$/i.test(typed) ? `sudo hire ${SITE_NAME}` : typed,
    hint: 'Run as root',
    icon: 'terminal',
    shell: true,
  }
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
