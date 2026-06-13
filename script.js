const navLinks = document.querySelectorAll('header nav a');
const sections = document.querySelectorAll('main section');
const contactForm = document.getElementById('contactForm');
const aboutCarousel = document.querySelector('.about-carousel-slider');
const aboutDots = document.querySelectorAll('.about-carousel-dot');

navLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

const updateActiveNav = () => {
  const scrollPosition = window.scrollY + window.innerHeight / 4;
  sections.forEach((section) => {
    const top = section.offsetTop;
    const height = section.offsetHeight;
    const id = section.getAttribute('id');
    const link = document.querySelector(`header nav a[href="#${id}"]`);
    if (!link) return;
    if (scrollPosition >= top && scrollPosition < top + height) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
};

window.addEventListener('scroll', updateActiveNav);
window.addEventListener('load', updateActiveNav);

const carousel = document.querySelector('.carousel-slider');
const carouselDots = document.querySelectorAll('.carousel-dot');
let currentSlide = 0;
const totalSlides = carouselDots.length;

const showSlide = (index) => {
  if (!carousel || totalSlides === 0) return;
  currentSlide = index;
  carousel.style.transform = `translateX(-${index * 100}%)`;
  carouselDots.forEach((dot) => {
    dot.classList.toggle('active', Number(dot.dataset.slide) === index);
  });
};

carouselDots.forEach((dot) => {
  dot.addEventListener('click', () => showSlide(Number(dot.dataset.slide)));
});

if (totalSlides > 1) {
  setInterval(() => {
    showSlide((currentSlide + 1) % totalSlides);
  }, 5000);
}

if (aboutCarousel && aboutDots.length > 0) {
  let currentAboutIndex = 0;
  const totalAboutSlides = aboutDots.length;

  const showAboutSlide = (index) => {
    currentAboutIndex = index;
    aboutCarousel.style.transform = `translateX(-${index * 100}%)`;
    aboutDots.forEach((dot) => {
      dot.classList.toggle('active', Number(dot.dataset.slide) === index);
    });
  };

  aboutDots.forEach((dot) => {
    dot.addEventListener('click', () => showAboutSlide(Number(dot.dataset.slide)));
  });

  if (totalAboutSlides > 1) {
    setInterval(() => {
      showAboutSlide((currentAboutIndex + 1) % totalAboutSlides);
    }, 5000);
  }
}

if (contactForm) {
  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    alert('Thank you! Your request has been submitted. We will contact you soon.');
    contactForm.reset();
  });
}

console.log('Chitkote Logistics Website Loaded');