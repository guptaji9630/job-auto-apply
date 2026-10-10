export interface Resume {
  personal: PersonalInfo;
  professionalSummary: string;
  education: Education[];
  experience: Experience[];
  projects: Project[];
  skills: SkillCategory[];
  certifications: string[];
  languages: string[];
}

export interface PersonalInfo {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
}

export interface Education {
  degree: string;
  institution: string;
  location: string;
  cgpa?: string;
  period: string;
}

export interface Experience {
  title: string;
  company: string;
  period: string;
  items: string[];
}

export interface Project {
  title: string;
  items: string[];
}

export interface SkillCategory {
  label: string;
  skills: string;
}

export function parsePortfolioResume(): Resume {
  return {
    personal: {
      name: 'Abhishek Gupta',
      email: 'abhishekg9630@gmail.com',
      phone: '+91-9560934582',
      location: 'India',
      linkedin: 'https://linkedin.com/in/abhishekgupta',
      github: 'https://github.com/guptaji9630',
      portfolio: 'https://portfolio.example.com',
    },
    professionalSummary: `Dedicated Quality Assurance Engineer with hands-on experience in manual and automated testing. Skilled in identifying bugs, ensuring product quality, and improving testing processes. Strong background in software development with expertise in MERN stack and testing frameworks like Jest and Playwright. Proficient in AI-assisted development using GitHub Copilot, Cursor, and ChatGPT for test automation, code generation, and debugging. Committed to delivering high-quality software through rigorous testing and continuous improvement.`,
    education: [{
      degree: 'B.Tech. Computer Science & Engineering',
      institution: 'KCC Institute of Technology and Management',
      location: 'Greater Noida',
      cgpa: '7.0',
      period: 'May 2021 - Mar 2025',
    }],
    experience: [
      {
        title: 'Associate Engineer (QA)',
        company: 'Successive Digital',
        period: 'May 2025 - Present',
        items: [
          'Ran manual checks on new features to ensure everything worked as expected',
          'Reported clear and detailed issues to help speed up fixes',
          'Helped improve the testing process by sharing feedback with the team'
        ]
      },
      {
        title: 'Software Engineer Trainee',
        company: 'Successive Digital',
        period: 'May 2025 - Nov 2025',
        items: [
          'Developed the fitness-forge MERN app',
          'Develop skills in Next.js, Node.js with Jest Testing',
          'Technologies used: JavaScript, NEXT.js, Axios, MongoDB, Git, Github, Node.js, Graph QL'
        ]
      },
      {
        title: 'Freelance Web Developer',
        company: 'Freelance',
        period: 'May 2023 - Mar 2024',
        items: [
          'Delivered tailored web development solutions for various clients using React.js and Node.js',
          'Improved user experience and boosted website traffic by 15% on average',
          'Managed end-to-end project lifecycles, ensuring timely and high-quality deliverables'
        ]
      }
    ],
    projects: [
      {
        title: 'Trail Management System - Agmatix',
        items: [
          'Tested core features of the trial platform to ensure smooth data flow and reliable performance',
          'Reported bugs with clear steps and worked with the team to improve system quality',
          'Checked each update of the tool to make sure it stayed stable and easy to use'
        ]
      },
      {
        title: 'FitForge - The Fitness Tracker',
        items: [
          'Developed a full stack web app using MERN stack for fitness lovers',
          'The application shows the analytical data of the workout with progress photo feature',
          'Libraries: MERN, Graph QL'
        ]
      }
    ],
    skills: [
      { label: 'QA & Testing', skills: 'Manual Testing, Automated Testing, Bug Reporting, Test Cases, Jest, Playwright, Selenium, Cypress, API Testing, Regression Testing, Smoke Testing' },
      { label: 'Development', skills: 'JavaScript, React Native, Node.js, HTML, CSS, MERN Stack, Next.js' },
      { label: 'Tools & Others', skills: 'Git, GitHub, MongoDB, MySQL, Postman, Android Development, C++, Python, Docker, CI/CD Pipelines' },
      { label: 'AI Development Tools', skills: 'GitHub Copilot, Cursor IDE, ChatGPT, Claude Code, AI-assisted testing, Prompt engineering for test generation' }
    ],
    certifications: [
      'Machine Learning Course by Andrew Ng on Coursera',
      'Java Foundational Certification on Udemy',
      'Digital Marketing Certification on Google',
      'GraphQL Associate Certification'
    ],
    languages: ['Hindi', 'English'],
  };
}