barRest =  {\skip 2 |}

paperOFF = { \set Score.skipTypesetting = ##t }
paperON = { \set Score.skipTypesetting = ##f }

hidePP = \tweak #'stencil ##f \pp
ppWhiteOut = \markup { \whiteout { \dynamic "pp" } }

posBeamA = \once \override Beam.damping = #2

shpSlurA = \shape #'( ((0 . -0.3) (8 . 0.5) (0 . 1) (0 . 0))
                      ((0 . 0) (0 . 0) (-3 . -0.7) (0 . -0.7)) ) PhrasingSlur
shpSlurB = \shape #'((0 . 2.8) (0 . 1) (0 . -0.6) (0 . 0)) PhrasingSlur
shpSlurC = \shape #'( ((0.8 . 0) (0.8 . 0) (0 . 0) (0 . 0))
                      ((0 . -0.5) (0 . -0.5) (-1 . 1) (-0.5 . 2)) ) PhrasingSlur
shpSlurD = \shape #'( ((0.3 . 0) (3 . 1) (-3 . 1) (0 . 0))
                      ((0 . 0) (0 . 0.3) (0 . 0.8) (0 . -0.7)) ) PhrasingSlur

shpSlurE = \shape #'((0 . 1) (0 . 0.6) (0 . 0.5) (0 . 0)) PhrasingSlur

posScriptA = \once \override Script.extra-offset = #'(-3 . 0)
posScriptB = \once \override TextScript.extra-offset = #'(-1.8 . -2.6)
posAccidental = \once \override Staff.AccidentalPlacement.right-padding = #1.5

