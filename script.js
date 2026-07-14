// Selectors
const navLinks = document.querySelectorAll('.main-nav a');
const sections = document.querySelectorAll('main section');
const header = document.querySelector('.site-header');
const mobileToggle = document.querySelector('.mobile-nav-toggle');

// 1. Navigation & Mobile Menu
const scrollToSection = (target) => {
  if (!target) return;
  const headerHeight = header.offsetHeight;
  const elementPosition = target.getBoundingClientRect().top;
  const offsetPosition = elementPosition + window.pageYOffset - headerHeight + 10;
  
  window.scrollTo({
    top: offsetPosition,
    behavior: 'smooth'
  });
};

navLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const target = document.querySelector(link.getAttribute('href'));
    scrollToSection(target);
    if (header?.classList.contains('nav-open')) {
      header.classList.remove('nav-open');
      mobileToggle?.setAttribute('aria-expanded', 'false');
    }
  });
});

const updateActiveNav = () => {
  const scrollPosition = window.scrollY + window.innerHeight / 3;
  sections.forEach((section) => {
    const top = section.offsetTop;
    const height = section.offsetHeight;
    const id = section.getAttribute('id');
    const link = document.querySelector(`.main-nav a[href="#${id}"]`);
    if (!link) return;
    
    if (scrollPosition >= top && scrollPosition < top + height) {
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    }
  });
};

window.addEventListener('scroll', updateActiveNav);
window.addEventListener('load', updateActiveNav);

if (mobileToggle && header) {
  mobileToggle.addEventListener('click', () => {
    const isOpen = header.classList.toggle('nav-open');
    mobileToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
}

// 2. About Carousel (preserving original sliding logic)
const aboutCarousel = document.querySelector('.about-carousel-slider');
const aboutDots = document.querySelectorAll('.about-carousel-dot');

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
    dot.addEventListener('click', () => {
      const slideIndex = Number(dot.getAttribute('data-slide'));
      showAboutSlide(slideIndex);
    });
  });

  if (totalAboutSlides > 1) {
    setInterval(() => {
      showAboutSlide((currentAboutIndex + 1) % totalAboutSlides);
    }, 5000);
  }
}

// 3. Route & Cost Estimator
const routeDatabase = {
  "Hyderabad-Chennai": { distance: 630, time: 14, rate: 35 },
  "Hyderabad-Coimbatore": { distance: 920, time: 20, rate: 37 },
  "Hyderabad-Madurai": { distance: 990, time: 22, rate: 38 },
  "Hyderabad-Pune": { distance: 560, time: 12, rate: 36 },
  "Hyderabad-Mumbai": { distance: 710, time: 16, rate: 36 },
  "Hyderabad-Bengaluru": { distance: 570, time: 11, rate: 35 },
  
  "Chennai-Hyderabad": { distance: 630, time: 14, rate: 35 },
  "Chennai-Pune": { distance: 1180, time: 24, rate: 38 },
  "Chennai-Mumbai": { distance: 1330, time: 27, rate: 39 },
  "Chennai-Coimbatore": { distance: 500, time: 10, rate: 34 },
  "Chennai-Madurai": { distance: 460, time: 9, rate: 34 },
  "Chennai-Bengaluru": { distance: 350, time: 7, rate: 33 },

  "Pune-Chennai": { distance: 1180, time: 24, rate: 38 },
  "Pune-Hyderabad": { distance: 560, time: 12, rate: 36 },
  "Pune-Mumbai": { distance: 150, time: 4, rate: 42 },
  "Pune-Coimbatore": { distance: 1200, time: 25, rate: 39 },
  "Pune-Madurai": { distance: 1310, time: 27, rate: 40 },
  "Pune-Bengaluru": { distance: 840, time: 17, rate: 37 },

  "Mumbai-Chennai": { distance: 1330, time: 27, rate: 39 },
  "Mumbai-Hyderabad": { distance: 710, time: 16, rate: 36 },
  "Mumbai-Pune": { distance: 150, time: 4, rate: 42 },
  "Mumbai-Coimbatore": { distance: 1360, time: 28, rate: 40 },
  "Mumbai-Madurai": { distance: 1450, time: 30, rate: 41 },
  "Mumbai-Bengaluru": { distance: 980, time: 19, rate: 37 },

  "Coimbatore-Hyderabad": { distance: 920, time: 20, rate: 37 },
  "Coimbatore-Chennai": { distance: 500, time: 10, rate: 34 },
  "Coimbatore-Pune": { distance: 1200, time: 25, rate: 39 },
  "Coimbatore-Mumbai": { distance: 1360, time: 28, rate: 40 },
  "Coimbatore-Madurai": { distance: 270, time: 6, rate: 35 },
  "Coimbatore-Bengaluru": { distance: 360, time: 8, rate: 33 },

  "Madurai-Hyderabad": { distance: 990, time: 22, rate: 38 },
  "Madurai-Chennai": { distance: 460, time: 9, rate: 34 },
  "Madurai-Pune": { distance: 1310, time: 27, rate: 40 },
  "Madurai-Mumbai": { distance: 1450, time: 30, rate: 41 },
  "Madurai-Coimbatore": { distance: 270, time: 6, rate: 35 },
  "Madurai-Bengaluru": { distance: 430, time: 9, rate: 34 },

  "Bengaluru-Hyderabad": { distance: 570, time: 11, rate: 35 },
  "Bengaluru-Chennai": { distance: 350, time: 7, rate: 33 },
  "Bengaluru-Pune": { distance: 840, time: 17, rate: 37 },
  "Bengaluru-Mumbai": { distance: 980, time: 19, rate: 37 },
  "Bengaluru-Coimbatore": { distance: 360, time: 8, rate: 33 },
  "Bengaluru-Madurai": { distance: 430, time: 9, rate: 34 }
};

const btnCalculate = document.getElementById('btnCalculate');
const estOrigin = document.getElementById('estOrigin');
const estDestination = document.getElementById('estDestination');
const estTruck = document.getElementById('estTruck');
const estCompany = document.getElementById('estCompany');
const estPhone = document.getElementById('estPhone');
const estimatorResult = document.getElementById('estimatorResult');
const resDistance = document.getElementById('resDistance');
const resTime = document.getElementById('resTime');
const resPrice = document.getElementById('resPrice');

if (btnCalculate) {
  btnCalculate.addEventListener('click', () => {
    const origin = estOrigin.value;
    const dest = estDestination.value;
    const truck = estTruck.value;
    const company = estCompany ? estCompany.value.trim() : '';
    const phone = estPhone ? estPhone.value.trim() : '';

    if (!origin || !dest) {
      alert("Please select both Origin and Destination hubs.");
      return;
    }

    if (origin === dest) {
      alert("Origin and Destination cannot be the same city.");
      return;
    }

    if (!company) {
      alert("Please enter your Company Name to view the estimate.");
      estCompany.focus();
      return;
    }

    if (!phone || phone.length < 10) {
      alert("Please enter a valid 10-digit Mobile Number to view the estimate.");
      estPhone.focus();
      return;
    }

    const routeKey = `${origin}-${dest}`;
    let routeInfo = routeDatabase[routeKey];
    
    // Fallback if not directly in database
    if (!routeInfo) {
      const calcDist = Math.abs(origin.charCodeAt(0) - dest.charCodeAt(0)) * 45 + 280;
      const calcTime = Math.ceil(calcDist / 45);
      routeInfo = { distance: calcDist, time: calcTime, rate: 35 };
    }

    // Rates based on truck type
    let multiplier = 1.0;
    if (truck === '32ft') multiplier = 1.6;
    if (truck === 'open') multiplier = 1.35;

    const baseCost = routeInfo.distance * routeInfo.rate * multiplier;
    const minCost = Math.round((baseCost * 0.95) / 100) * 100;
    const maxCost = Math.round((baseCost * 1.05) / 100) * 100;

    resDistance.textContent = `${routeInfo.distance} km`;
    resTime.textContent = `${routeInfo.time} hours`;
    resPrice.textContent = `₹${minCost.toLocaleString('en-IN')} - ₹${maxCost.toLocaleString('en-IN')}`;

    estimatorResult.style.display = 'block';

    // Autofill Quote Form
    const quoteOrigin = document.getElementById('quoteOrigin');
    const quoteDestination = document.getElementById('quoteDestination');
    const formCompany = document.querySelector('input[name="company"]');
    const formPhone = document.querySelector('input[name="phone"]');
    const formVehiclePref = document.querySelector('select[name="vehiclePref"]');

    if (quoteOrigin) quoteOrigin.value = origin;
    if (quoteDestination) quoteDestination.value = dest;
    if (formCompany) formCompany.value = company;
    if (formPhone) formPhone.value = phone;
    if (formVehiclePref) formVehiclePref.value = truck;
  });
}

// 3.5 Cost Estimator & Quote Wizard Sync
const lnkFinishBooking = document.getElementById('lnkFinishBooking');
if (lnkFinishBooking) {
  lnkFinishBooking.addEventListener('click', () => {
    const quoteDate = document.getElementById('quoteDate');
    if (quoteDate) {
      setTimeout(() => {
        quoteDate.focus();
      }, 600);
    }
  });
}

// 4. Shipment Tracker Simulation
const mockTrackingData = {
  "CK-7842": {
    route: "Hyderabad → Chennai",
    status: "in-transit",
    statusText: "In Transit",
    timeText: "Updated 12 mins ago",
    step: 3,
    vehicle: "20 ft Container Truck",
    weight: "8.2 Tons",
    driver: "Laxman Rao (+91 93900 03955)",
    loc: "Nellore Bypass Highway / ETA 3.5 Hours"
  },
  "CK-9012": {
    route: "Pune → Coimbatore",
    status: "delivered",
    statusText: "Delivered",
    timeText: "Delivered Yesterday, 04:30 PM",
    step: 4,
    vehicle: "32 ft Container Truck",
    weight: "17.4 Tons",
    driver: "Vinay Kumar (+91 93900 03955)",
    loc: "Coimbatore Industrial Corridor / Unloading Complete"
  },
  "CK-3351": {
    route: "Mumbai → Hyderabad",
    status: "pending",
    statusText: "Dispatched",
    timeText: "Dispatched Today, 08:15 AM",
    step: 2,
    vehicle: "Open Body Truck",
    weight: "22.5 Tons",
    driver: "Satish G. (+91 93900 03955)",
    loc: "Solapur Depot Point / Fuel Stop"
  }
};

const btnTrack = document.getElementById('btnTrack');
const trackingIdInput = document.getElementById('trackingId');
const trackerResult = document.getElementById('trackerResult');
const trackRoute = document.getElementById('trackRoute');
const trackTime = document.getElementById('trackTime');
const trackBadge = document.getElementById('trackBadge');
const timelineProgress = document.getElementById('timelineProgress');

const metaVehicle = document.getElementById('metaVehicle');
const metaWeight = document.getElementById('metaWeight');
const metaDriver = document.getElementById('metaDriver');
const metaLoc = document.getElementById('metaLoc');

const setDemoCode = (code) => {
  if (trackingIdInput) {
    trackingIdInput.value = code;
    runTrackingSimulation(code);
  }
};
window.setDemoCode = setDemoCode; // Export to global scope for onclick attributes

const runTrackingSimulation = (code) => {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    alert("Please enter a tracking ID.");
    return;
  }

  let data = mockTrackingData[cleanCode];

  // Dynamic Generator for any other code
  if (!data) {
    const states = ["pending", "in-transit", "delivered"];
    const chosenStatus = states[Math.abs(cleanCode.hashCode ? cleanCode.hashCode() : cleanCode.length) % 3];
    let step = 2;
    let statusText = "Dispatched";
    
    if (chosenStatus === "in-transit") {
      step = 3;
      statusText = "In Transit";
    } else if (chosenStatus === "delivered") {
      step = 4;
      statusText = "Delivered";
    }

    data = {
      route: "Hyderabad → Pune",
      status: chosenStatus,
      statusText: statusText,
      timeText: "Updated Just Now",
      step: step,
      vehicle: "32 ft Container Truck",
      weight: `${(10 + Math.random() * 10).toFixed(1)} Tons`,
      driver: "Anand Singh (+91 93900 03955)",
      loc: chosenStatus === "delivered" ? "Pune Warehouse / Completed" : "Satara Toll Plaza / In Transit"
    };
  }

  // Update DOM Elements
  trackRoute.textContent = data.route;
  trackTime.textContent = data.timeText;
  trackBadge.textContent = data.statusText;
  
  // Reset badge class list
  trackBadge.className = "tracker-badge";
  trackBadge.classList.add(data.status);

  metaVehicle.textContent = data.vehicle;
  metaWeight.textContent = data.weight;
  metaDriver.textContent = data.driver;
  metaLoc.textContent = data.loc;

  // Draw Timeline Stepper
  const steps = [1, 2, 3, 4];
  steps.forEach(s => {
    const stepEl = document.getElementById(`step${s}`);
    if (stepEl) {
      stepEl.className = "timeline-step";
      if (s < data.step) {
        stepEl.classList.add("completed");
      } else if (s === data.step) {
        if (data.status === "delivered") {
          stepEl.classList.add("completed");
        } else {
          stepEl.classList.add("active");
        }
      }
    }
  });

  // Calculate and apply progress bar size
  setTimeout(() => {
    const isMobile = window.innerWidth <= 768;
    const progressPercent = ((data.step - 1) / 3) * 100;
    if (isMobile) {
      timelineProgress.style.width = '4px';
      timelineProgress.style.height = `${progressPercent}%`;
    } else {
      timelineProgress.style.height = '4px';
      timelineProgress.style.width = `${progressPercent}%`;
    }
  }, 100);

  trackerResult.style.display = 'block';
  trackerResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

// String hash helper for deterministic demo values
String.prototype.hashCode = function() {
  let hash = 0;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
};

if (btnTrack) {
  btnTrack.addEventListener('click', () => {
    runTrackingSimulation(trackingIdInput.value);
  });
}

// 5. Fleet Specifications Tabs
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.fleet-tab-content');

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetTab = btn.getAttribute('data-tab');

    tabButtons.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById(targetTab).classList.add('active');
  });
});

// 6. FAQ Accordion (Smooth CSS transition heights)
const faqQuestions = document.querySelectorAll('.faq-question');

faqQuestions.forEach(q => {
  q.addEventListener('click', () => {
    const faqItem = q.parentElement;
    const faqAnswer = faqItem.querySelector('.faq-answer');
    const isActive = faqItem.classList.contains('active');

    // Close all other FAQs
    document.querySelectorAll('.faq-item').forEach(item => {
      item.classList.remove('active');
      item.querySelector('.faq-answer').style.maxHeight = null;
    });

    if (!isActive) {
      faqItem.classList.add('active');
      faqAnswer.style.maxHeight = `${faqAnswer.scrollHeight}px`;
    }
  });
});

// 7. Multi-step Quote Request Wizard
let currentStep = 1;
const formSteps = document.querySelectorAll('.form-step');
const stepNodes = document.querySelectorAll('.wizard-step-node');
const stepLabels = document.querySelectorAll('.wizard-step-label span');
const wizardBar = document.getElementById('wizardBar');

const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const btnSubmit = document.getElementById('btnSubmit');
const contactForm = document.getElementById('contactForm');

const updateWizardUI = () => {
  // Update step cards visibility
  formSteps.forEach((step, idx) => {
    step.classList.toggle('active', idx + 1 === currentStep);
  });

  // Update progress numbers
  stepNodes.forEach((node, idx) => {
    node.className = "wizard-step-node";
    if (idx + 1 < currentStep) {
      node.classList.add('completed');
    } else if (idx + 1 === currentStep) {
      node.classList.add('active');
    }
  });

  // Update progress texts
  stepLabels.forEach((label, idx) => {
    label.classList.toggle('active', idx + 1 === currentStep);
  });

  // Update top progress bar width
  const progressPercent = ((currentStep - 1) / 2) * 100;
  wizardBar.style.width = `${progressPercent}%`;

  // Update navigation buttons
  if (currentStep === 1) {
    btnPrev.style.display = 'none';
    btnNext.style.display = 'block';
    btnSubmit.style.display = 'none';
  } else if (currentStep === 2) {
    btnPrev.style.display = 'block';
    btnNext.style.display = 'block';
    btnSubmit.style.display = 'none';
  } else if (currentStep === 3) {
    btnPrev.style.display = 'block';
    btnNext.style.display = 'none';
    btnSubmit.style.display = 'block';
  }
};

const validateCurrentStep = () => {
  const activeStepEl = document.getElementById(`formStep${currentStep}`);
  if (!activeStepEl) return true;

  const requiredFields = activeStepEl.querySelectorAll('[required]');
  let isValid = true;

  requiredFields.forEach(field => {
    if (!field.value.trim()) {
      field.reportValidity();
      isValid = false;
    }
  });

  return isValid;
};

if (btnNext) {
  btnNext.addEventListener('click', () => {
    if (validateCurrentStep()) {
      currentStep++;
      updateWizardUI();
    }
  });
}

if (btnPrev) {
  btnPrev.addEventListener('click', () => {
    currentStep--;
    updateWizardUI();
  });
}

if (contactForm) {
  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    if (validateCurrentStep()) {
      const formData = new FormData(contactForm);
      const company = formData.get('company');
      const origin = formData.get('origin');
      const destination = formData.get('destination');
      const phone = formData.get('phone');
      const email = formData.get('email') || 'N/A';
      const pickupDate = formData.get('pickupDate');
      const cargoType = formData.get('cargoType');
      const weight = formData.get('weight');
      const vehiclePref = formData.get('vehiclePref');
      const message = formData.get('message') || 'None';

      let vehicleName = "20 ft Container Truck (7-9 Tons)";
      if (vehiclePref === '32ft') vehicleName = "32 ft Container Truck (15-20 Tons)";
      else if (vehiclePref === 'open') vehicleName = "Open Body Truck (Up to 25 Tons)";
      else if (vehiclePref === 'not_sure') vehicleName = "Not Sure (Coordinator Decides)";

      // Disable submit button temporarily to prevent duplicate clicks
      btnSubmit.disabled = true;
      const originalSubmitText = btnSubmit.textContent;
      btnSubmit.textContent = "Submitting Enquiry...";

      // Web3Forms API Key Config
      const WEB3FORMS_ACCESS_KEY = "fbf28086-def8-491b-9c38-7ae1a6ba0a58"; // Web3Forms Access Key for chitkote.logistics@gmail.com

      if (WEB3FORMS_ACCESS_KEY && WEB3FORMS_ACCESS_KEY !== "YOUR_WEB3FORMS_ACCESS_KEY") {
        try {
          await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({
              access_key: WEB3FORMS_ACCESS_KEY,
              subject: `New Cargo Enquiry from ${company} (${origin} to ${destination})`,
              from_name: "Chitkote Logistics Website",
              to_email: "chitkote.logistics@gmail.com",
              company: company,
              phone: phone,
              email: email,
              origin: origin,
              destination: destination,
              pickup_date: pickupDate,
              cargo_details: `${cargoType} (${weight} Tons)`,
              vehicle_preference: vehicleName,
              notes: message
            })
          });
        } catch (err) {
          console.error("Email submission error:", err);
        }
      }

      // Restore submit button state
      btnSubmit.disabled = false;
      btnSubmit.textContent = originalSubmitText;

      // Format WhatsApp message
      const whatsappMessage = `*New Quote Request - Chitkote Logistics*\n` +
                              `---------------------------------------\n` +
                              `• *Company:* ${company}\n` +
                              `• *Route:* ${origin} to ${destination}\n` +
                              `• *Pickup Date:* ${pickupDate}\n` +
                              `• *Cargo:* ${cargoType} (${weight} Tons)\n` +
                              `• *Vehicle Type:* ${vehicleName}\n` +
                              `• *Mobile:* ${phone}\n` +
                              `• *Email:* ${email}\n` +
                              `• *Notes:* ${message}`;
      
      const encodedMsg = encodeURIComponent(whatsappMessage);
      const whatsappUrl = `https://wa.me/919390003955?text=${encodedMsg}`;

      alert(`Thank you, ${company}! Your quote request has been sent via email.\n\nClicking OK will direct you to WhatsApp to connect directly with our Cargo Coordinator.`);
      
      // Open WhatsApp in new tab
      window.open(whatsappUrl, '_blank');
      
      // Reset form and go back to step 1
      contactForm.reset();
      currentStep = 1;
      updateWizardUI();
    }
  });
}

// 8. Interactive Corridor Map Logic
const mapHubs = document.querySelectorAll('.map-hub');
const routeCards = document.querySelectorAll('.route-card');
const mapLinks = document.querySelectorAll('.map-link');

if (mapHubs.length > 0) {
  mapHubs.forEach(hub => {
    hub.addEventListener('mouseenter', () => {
      const city = hub.getAttribute('data-city').toLowerCase();
      
      // Highlight map links that contain abbreviation of hovered hub
      const prefix = city === 'mumbai' ? 'bom' : (city === 'pune' ? 'pnq' : (city === 'hyderabad' ? 'hyd' : (city === 'bengaluru' ? 'blr' : (city === 'chennai' ? 'maa' : (city === 'coimbatore' ? 'cbe' : 'ixm')))));
      mapLinks.forEach(link => {
        if (link.className.baseVal.includes(prefix)) {
          link.classList.add('active');
        }
      });

      // Highlight route cards matching city
      routeCards.forEach(card => {
        const route = card.getAttribute('data-route');
        if (route.includes(city) || (city === 'chennai' && route.includes('tamilnadu'))) {
          card.classList.add('active');
        }
      });
    });

    hub.addEventListener('mouseleave', () => {
      mapLinks.forEach(link => link.classList.remove('active'));
      routeCards.forEach(card => card.classList.remove('active'));
    });
  });

  // Inverse highlight: hover cards highlight corresponding map features
  routeCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      const route = card.getAttribute('data-route');
      let lines = [];
      let hubs = [];

      if (route === 'hyderabad-chennai') {
        lines = ['.line-hyd-maa'];
        hubs = ['.hub-hyd', '.hub-maa'];
      } else if (route === 'hyderabad-coimbatore') {
        lines = ['.line-hyd-blr', '.line-blr-cbe'];
        hubs = ['.hub-hyd', '.hub-blr', '.hub-cbe'];
      } else if (route === 'hyderabad-madurai') {
        lines = ['.line-hyd-blr', '.line-blr-maa', '.line-maa-ixm'];
        hubs = ['.hub-hyd', '.hub-blr', '.hub-maa', '.hub-ixm'];
      } else if (route === 'mumbai-chennai') {
        lines = ['.line-bom-hyd', '.line-hyd-maa'];
        hubs = ['.hub-mumbai', '.hub-hyd', '.hub-maa'];
      } else if (route === 'pune-chennai') {
        lines = ['.line-pnq-hyd', '.line-hyd-maa'];
        hubs = ['.hub-pune', '.hub-hyd', '.hub-maa'];
      } else if (route === 'tamilnadu-maharashtra') {
        lines = ['.line-bom-hyd', '.line-bom-pnq', '.line-hyd-maa'];
        hubs = ['.hub-mumbai', '.hub-pune', '.hub-hyd', '.hub-maa'];
      }

      lines.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => el.classList.add('active'));
      });
      hubs.forEach(sel => {
        const h = document.querySelector(sel);
        if (h) h.classList.add('active');
      });
    });

    card.addEventListener('mouseleave', () => {
      mapLinks.forEach(link => link.classList.remove('active'));
      mapHubs.forEach(hub => hub.classList.remove('active'));
    });
  });
}

console.log('Chitkote Logistics Premium Website Modules Loaded.');
