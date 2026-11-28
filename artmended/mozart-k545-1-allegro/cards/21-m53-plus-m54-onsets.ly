\version "2.26.0"
#(set-global-staff-size 25)

\paper {
  indent = 0\mm
  top-margin = 4\mm
  bottom-margin = 4\mm
  left-margin = 4\mm
  right-margin = 4\mm
  paper-width = 150\mm
  paper-height = 75\mm
  print-page-number = ##f
  tagline = ##f
  page-breaking = #ly:one-page-breaking
}

upperCard = {
  \clef treble
  \key c \major
  \time 4/4
  \mark \markup { \box \bold "m. 53" }
  < c''-2 e''-4 >4-.
r4
r4
< c'' e'' >4-.
  d''16-5 s1*15/16
  \bar "|."
}

lowerCard = {
  \clef "bass"
  \key c \major
  \time 4/4
  c8-5
d16
e16
f16
g16
a16-3
b16
c'16
b16
a16-1
g16
f16
e16-1
d16
c16
  \once \set fingeringOrientations = #'(right)

< f-2 a-1 >1\p
  \bar "|."
}

\score {
  \new PianoStaff <<
    \set PianoStaff.connectArpeggios = ##t
    \new Staff = "upper" \upperCard
    \new Staff = "lower" \lowerCard
  >>
  \layout {
    ragged-right = ##f
    system-count = 1
  }
}
